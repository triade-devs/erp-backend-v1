import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateSupportGrantDto } from './dto/create-support-grant.dto.js';
import type { AuthenticatedUser } from '../common/interfaces/request-context.interface.js';
import type { EnvConfig } from '../common/config/env.validation.js';

/** Duração do grant de suporte: 15 minutos em milissegundos */
const SUPPORT_GRANT_TTL_MS = 15 * 60 * 1000;

/**
 * PlatformService — Operações administrativas de plataforma.
 *
 * Acesso restrito a usuários em `platform_admins`.
 *
 * Fase F do plano consolidado.
 */
@Injectable()
export class PlatformService {
  private readonly logger = new Logger(PlatformService.name);
  private readonly mfaEnforced: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<EnvConfig>,
  ) {
    // Flag de MFA — default false, ativar quando platform_admins tiverem MFA configurado
    this.mfaEnforced = this.configService.get('SUPPORT_MFA_ENFORCED') === 'true';
  }

  /**
   * Cria um support access grant para acesso temporário de suporte.
   *
   * Segurança (Caminho 3 completo do plano):
   * 1. MFA condicional: se SUPPORT_MFA_ENFORCED=true, exige aal === 'aal2'.
   * 2. Reason obrigatório com tamanho mínimo (validado no DTO).
   * 3. Regra de quatro olhos: support_user_id !== granted_by.
   * 4. expires_at calculado no servidor (now + 15min) — nunca do client.
   * 5. reason e support_user_id duplicados visivelmente no registro.
   */
  async createSupportGrant(dto: CreateSupportGrantDto, grantorUser: AuthenticatedUser) {
    // ── 1. MFA condicional ────────────────────────────────────────────────────
    if (this.mfaEnforced && grantorUser.aal !== 'aal2') {
      this.logger.warn(`Support grant bloqueado por MFA: user=${grantorUser.id} aal=${grantorUser.aal}`);
      throw new ForbiddenException(
        'Autenticação multifator (MFA) é obrigatória para criar support grants. ' +
          'Verifique seu authenticator e faça login novamente com MFA.',
      );
    }

    // ── 2. Regra de quatro olhos ──────────────────────────────────────────────
    if (dto.support_user_id === grantorUser.id) {
      throw new BadRequestException(
        'Você não pode criar um grant de suporte para si mesmo (regra de quatro olhos). ' +
          'O grant deve ser criado por outro administrador de plataforma.',
      );
    }

    // ── 3. Validar que a empresa existe ───────────────────────────────────────
    const company = await this.prisma.db.companies.findUnique({
      where: { id: dto.company_id },
      select: { id: true, name: true },
    });

    if (!company) {
      throw new BadRequestException(`Empresa não encontrada: ${dto.company_id}`);
    }

    // ── 4. Validar que o support_user é platform_admin ────────────────────────
    const supportAdmin = await this.prisma.db.platform_admins.findUnique({
      where: { user_id: dto.support_user_id },
      select: { user_id: true },
    });

    if (!supportAdmin) {
      throw new BadRequestException('O usuário de suporte especificado não é um administrador de plataforma.');
    }

    // ── 5. Calcular expires_at no servidor ────────────────────────────────────
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SUPPORT_GRANT_TTL_MS);

    // ── 6. Criar o grant ──────────────────────────────────────────────────────
    const grant = await this.prisma.db.support_access_grants.create({
      data: {
        company_id: dto.company_id,
        support_user_id: dto.support_user_id,
        granted_by: grantorUser.id,
        started_at: now,
        expires_at: expiresAt,
        reason: dto.reason,
      },
      select: {
        id: true,
        company_id: true,
        support_user_id: true,
        granted_by: true,
        started_at: true,
        expires_at: true,
        reason: true,
      },
    });

    this.logger.log(
      `Support grant criado: id=${grant.id} ` +
        `company=${grant.company_id} ` +
        `support_user=${grant.support_user_id} ` +
        `granted_by=${grant.granted_by} ` +
        `expires_at=${grant.expires_at.toISOString()}`,
    );

    return {
      grantId: grant.id,
      companyId: grant.company_id,
      supportUserId: grant.support_user_id,
      grantedBy: grant.granted_by,
      startedAt: grant.started_at,
      expiresAt: grant.expires_at,
      reason: grant.reason,
      ttlMinutes: 15,
    };
  }
}