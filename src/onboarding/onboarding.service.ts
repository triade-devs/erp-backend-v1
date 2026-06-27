import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateCompanyDto } from './dto/create-company.dto.js';
import type { UpdateFiscalDataDto } from './dto/update-fiscal-data.dto.js';
import type { AcceptInvitationDto } from './dto/accept-invitation.dto.js';

/**
 * OnboardingService — Orquestra as três portas de entrada no sistema.
 *
 * E1 – POST /onboarding/companies (self-service: cria empresa + admin)
 * E2 – PATCH /onboarding/companies/:id/fiscal-data (finaliza onboarding fiscal)
 * E3 – POST /onboarding/invitations/:shortCode/accept (aceite de convite)
 *
 * Todas as operações são atômicas ($transaction) para evitar estados parciais.
 */
@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // E1 — Criação de empresa (self-service)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Cria uma nova empresa e configura o criador como administrador.
   *
   * Transação atômica:
   * 1. Cria `companies` (PENDING_SEED)
   * 2. Seed silencioso: company_settings + classificação raiz "GERAL"
   * 3. Cria membership do criador (active)
   * 4. Resolve role_template 'admin'
   * 5. Cria role da empresa a partir do template + role_permissions + membership_roles
   * 6. Atualiza setup_status para PENDING_FISCAL
   */
  async createCompany(dto: CreateCompanyDto, creatorUserId: string) {
    this.logger.log(`Criando empresa slug=${dto.slug} para user=${creatorUserId}`);

    return this.prisma.$transaction(async (tx) => {
      // ── 1. Criar empresa ──────────────────────────────────────────────────────
      let company: { id: string; name: string; slug: string };
      try {
        company = await tx.companies.create({
          data: {
            name: dto.name,
            slug: dto.slug,
            document: dto.document ?? null,
            plan_code: dto.plan_code ?? 'starter',
            created_by: creatorUserId,
            setup_status: 'PENDING_SEED',
          },
          select: { id: true, name: true, slug: true },
        });
      } catch (err: unknown) {
        if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'P2002') {
          throw new ConflictException(
            `Já existe uma empresa com o slug "${dto.slug}". Escolha outro slug.`,
          );
        }
        throw err;
      }

      // ── 2. Seed silencioso ────────────────────────────────────────────────────
      await this.seedSilentTenantEntities(tx, company.id);

      // ── 3. Criar membership do criador ────────────────────────────────────────
      const membership = await tx.memberships.create({
        data: {
          user_id: creatorUserId,
          company_id: company.id,
          status: 'active',
          joined_at: new Date(),
        },
        select: { id: true },
      });

      // ── 4. Resolver role_template 'admin' ─────────────────────────────────────
      const adminTemplate = await tx.role_templates.findUnique({
        where: { code: 'admin' },
        select: {
          code: true,
          name: true,
          description: true,
          template_permissions: {
            select: { permission_code: true },
          },
        },
      });

      if (!adminTemplate) {
        throw new BadRequestException(
          'Template de cargo "admin" não encontrado. Contate o suporte de plataforma.',
        );
      }

      // ── 5. Criar role + role_permissions + membership_roles ──────────────────
      const role = await tx.roles.create({
        data: {
          company_id: company.id,
          code: adminTemplate.code,
          name: adminTemplate.name,
          description: adminTemplate.description ?? null,
          template_code: adminTemplate.code,
          template_synced_at: new Date(),
          is_system: true,
          role_permissions: {
            createMany: {
              data: adminTemplate.template_permissions.map((tp) => ({
                permission_code: tp.permission_code,
                is_active: true,
              })),
              skipDuplicates: true,
            },
          },
        },
        select: { id: true },
      });

      await tx.membership_roles.create({
        data: {
          membership_id: membership.id,
          role_id: role.id,
        },
      });

      // ── 6. Avançar para PENDING_FISCAL ────────────────────────────────────────
      await tx.companies.update({
        where: { id: company.id },
        data: { setup_status: 'PENDING_FISCAL' },
      });

      this.logger.log(
        `Empresa criada: id=${company.id} slug=${company.slug} → PENDING_FISCAL`,
      );

      return {
        companyId: company.id,
        name: company.name,
        slug: company.slug,
        setupStatus: 'PENDING_FISCAL' as const,
        membershipId: membership.id,
        roleId: role.id,
      };
    });
  }

  /**
   * Seed silencioso de entidades mínimas para uma empresa recém-criada.
   * Roda dentro da transação principal do E1.
   */
  private async seedSilentTenantEntities(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    companyId: string,
  ): Promise<void> {
    // company_settings com defaults
    await tx.company_settings.create({
      data: {
        company_id: companyId,
        currency: 'BRL',
        timezone: 'America/Sao_Paulo',
      },
    });

    // Classificação raiz "GERAL" (nível department)
    await tx.product_classifications.create({
      data: {
        company_id: companyId,
        name: 'GERAL',
        level: 'department',
        parent_id: null,
        sort_order: 0,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // E2 — Atualização de dados fiscais (PENDING_FISCAL → ACTIVE)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Finaliza o onboarding fiscal da empresa.
   * Avança o setup_status de PENDING_FISCAL para ACTIVE.
   */
  async updateFiscalData(
    companyId: string,
    dto: UpdateFiscalDataDto,
    userId: string,
  ) {
    this.logger.log(`Atualizando dados fiscais: company=${companyId} user=${userId}`);

    const company = await this.prisma.db.companies.findUnique({
      where: { id: companyId },
      select: { setup_status: true },
    });

    if (!company) {
      throw new NotFoundException('Empresa não encontrada.');
    }

    if (company.setup_status !== 'PENDING_FISCAL') {
      throw new BadRequestException(
        `A empresa não está em fase de cadastro fiscal. Status atual: ${company.setup_status}`,
      );
    }

    const updated = await this.prisma.db.companies.update({
      where: { id: companyId },
      data: {
        document: dto.document,
        ...(dto.name && { name: dto.name }),
        setup_status: 'ACTIVE',
        updated_at: new Date(),
      },
      select: { id: true, name: true, slug: true, setup_status: true },
    });

    this.logger.log(`Empresa ${companyId} → ACTIVE`);

    return {
      companyId: updated.id,
      name: updated.name,
      slug: updated.slug,
      setupStatus: updated.setup_status,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // E3 — Aceite de convite (Portas 2 e 3)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Aceita um convite para uma empresa.
   *
   * Segurança (decisão #7):
   * - `shortCode` é apenas a chave de lookup (não é segredo).
   * - O `token` do body é comparado via SHA-256 contra `token_hash` armazenado.
   *
   * Transação atômica:
   * 1. Busca convite por short_code, valida status e expiração.
   * 2. Valida token contra hash.
   * 3. Cria membership (active).
   * 4. Cria membership_roles a partir de role_ids do convite.
   * 5. Marca convite como accepted.
   */
  async acceptInvitation(
    shortCode: string,
    dto: AcceptInvitationDto,
    userId: string,
  ) {
    this.logger.log(`Aceite de convite: shortCode=${shortCode} user=${userId}`);

    const invitation = await this.prisma.db.company_invitations.findUnique({
      where: { short_code: shortCode },
      select: {
        id: true,
        company_id: true,
        email: true,
        token_hash: true,
        role_ids: true,
        status: true,
        expires_at: true,
      },
    });

    // ── Validações de existência, status e expiração ──────────────────────────
    if (!invitation) {
      throw new NotFoundException('Convite não encontrado.');
    }

    if (invitation.status !== 'pending') {
      throw new BadRequestException(
        `Este convite já foi ${invitation.status === 'accepted' ? 'aceito' : 'revogado'}.`,
      );
    }

    if (invitation.expires_at <= new Date()) {
      throw new BadRequestException('Este convite expirou.');
    }

    // ── Validar token contra hash (decisão #7) ────────────────────────────────
    const computedHash = Buffer.from(
      createHash('sha256').update(dto.token).digest(),
    );

    if (!computedHash.equals(invitation.token_hash)) {
      this.logger.warn(
        `Token inválido para convite shortCode=${shortCode} user=${userId}`,
      );
      throw new UnauthorizedException('Token de convite inválido.');
    }

    // ── Transação: criar membership + roles + marcar aceito ───────────────────
    return this.prisma.$transaction(async (tx) => {
      // Verificar se já tem membership nessa empresa
      const existing = await tx.memberships.findUnique({
        where: {
          user_id_company_id: {
            user_id: userId,
            company_id: invitation.company_id,
          },
        },
        select: { id: true },
      });

      if (existing) {
        throw new ConflictException('Você já é membro desta empresa.');
      }

      // Criar membership
      const membership = await tx.memberships.create({
        data: {
          user_id: userId,
          company_id: invitation.company_id,
          status: 'active',
          invited_by: null, // o convite é anônimo em relação ao user_id do convidador
          invited_at: invitation.expires_at, // proxy para data do convite
          joined_at: new Date(),
        },
        select: { id: true },
      });

      // Criar membership_roles para cada role_id do convite
      if (invitation.role_ids.length > 0) {
        await tx.membership_roles.createMany({
          data: invitation.role_ids.map((roleId) => ({
            membership_id: membership.id,
            role_id: roleId,
          })),
          skipDuplicates: true,
        });
      }

      // Marcar convite como aceito
      await tx.company_invitations.update({
        where: { id: invitation.id },
        data: {
          status: 'accepted',
          accepted_at: new Date(),
          accepted_by: userId,
        },
      });

      this.logger.log(
        `Convite aceito: company=${invitation.company_id} user=${userId} membership=${membership.id}`,
      );

      return {
        companyId: invitation.company_id,
        membershipId: membership.id,
        rolesAssigned: invitation.role_ids.length,
      };
    });
  }
}
