import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../interfaces/request-context.interface.js';

/**
 * SupportAccessGuard — Modo Suporte via `X-Support-Grant`.
 *
 * Fluxo:
 * 1. Header `X-Support-Grant` ausente → passa sem efeito (modo suporte é opcional).
 * 2. Presente → busca `support_access_grants` pelo id fornecido.
 * 3. Valida que `expires_at > now()` e que o `support_user_id` bate com o usuário autenticado.
 * 4. Grant válido → sobrescreve `request.user` com flags de proxy de suporte,
 *    mantendo o `id` original do operador para auditoria.
 *
 * NOTA: Este guard deve ser o primeiro da pilha @TenantProtected(),
 * pois enriquece request.user antes do TenantGuard executar.
 */
@Injectable()
export class SupportAccessGuard implements CanActivate {
  private readonly logger = new Logger(SupportAccessGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();

    const grantId = request.headers['x-support-grant'] as string | undefined;

    // ── Sem header: fluxo normal ──────────────────────────────────────────────
    if (!grantId) {
      return true;
    }

    // ── Com header: validar o grant ───────────────────────────────────────────
    const user = request.user;
    if (!user) {
      // SupabaseAuthGuard deve ter executado antes
      throw new UnauthorizedException('Usuário não autenticado para usar X-Support-Grant.');
    }

    const grant = await this.prisma.db.support_access_grants.findUnique({
      where: { id: grantId },
      select: {
        id: true,
        company_id: true,
        support_user_id: true,
        expires_at: true,
      },
    });

    // Grant inexistente
    if (!grant) {
      this.logger.warn(`Support grant não encontrado: id=${grantId} user=${user.id}`);
      throw new UnauthorizedException('Support grant inválido ou expirado.');
    }

    // Grant expirado
    if (grant.expires_at <= new Date()) {
      this.logger.warn(
        `Support grant expirado: id=${grantId} expires_at=${grant.expires_at.toISOString()} user=${user.id}`,
      );
      throw new UnauthorizedException('Support grant expirado.');
    }

    // Grant pertence a outro usuário (prevenção de roubo de grant)
    if (grant.support_user_id !== user.id) {
      this.logger.warn(`Support grant pertence a user=${grant.support_user_id}, mas foi usado por user=${user.id}`);
      throw new UnauthorizedException('Support grant não pertence a este usuário.');
    }

    // ── Grant válido: enriquecer request.user ─────────────────────────────────
    this.logger.log(`Modo suporte ativado: user=${user.id} → company=${grant.company_id} grant=${grantId}`);

    request.user = {
      ...user,
      isSupportProxy: true,
      realCompanyId: grant.company_id,
    };

    return true;
  }
}