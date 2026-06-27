import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser, TenantContext } from '../interfaces/request-context.interface.js';
import { SUPPORT_PROXY_PERMISSIONS } from '../constants/support-permissions.constant.js';

/**
 * TenantGuard — Resolução de Tenant via Header `x-company-id`.
 *
 * Fluxo normal (usuário autenticado com membership):
 * 1. Lê `x-company-id` do header.
 * 2. Busca membership ativa do usuário naquela empresa, incluindo `setup_status`.
 * 3. Carrega as permissões via membership_roles → role_permissions.
 * 4. Injeta `TenantContext` no request para uso downstream.
 *
 * Fluxo de suporte (isSupportProxy = true, injetado pelo SupportAccessGuard):
 * 1. Pula o lookup de memberships — operador de suporte não tem membership.
 * 2. Valida que x-company-id bate com o realCompanyId do grant (decisão #4).
 * 3. Monta TenantContext com SUPPORT_PROXY_PERMISSIONS fixas (decisão #3).
 * 4. Ainda carrega setup_status da empresa para o CompanyActiveGuard.
 *
 * NOTA: Este guard depende do SupabaseAuthGuard (e opcionalmente do
 * SupportAccessGuard) já terem executado.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user: AuthenticatedUser; tenant?: TenantContext }>();

    const user = request.user;
    if (!user) {
      throw new ForbiddenException('TenantGuard requer SupabaseAuthGuard ativo antes.');
    }

    const companyId = request.headers['x-company-id'] as string | undefined;
    if (!companyId) {
      throw new ForbiddenException('Header x-company-id é obrigatório para acessar recursos de tenant.');
    }

    // ── Modo Suporte ──────────────────────────────────────────────────────────
    if (user.isSupportProxy) {
      // Valida que o header x-company-id bate com o grant (decisão #4)
      if (companyId !== user.realCompanyId) {
        this.logger.warn(
          `SupportProxy: header x-company-id=${companyId} não bate com grant.company_id=${user.realCompanyId}`,
        );
        throw new ForbiddenException('x-company-id não confere com o grant de suporte ativo.');
      }

      // Carrega setup_status da empresa sem checar membership
      const company = await this.prisma.db.companies.findUnique({
        where: { id: companyId },
        select: { setup_status: true },
      });

      if (!company) {
        throw new ForbiddenException('Empresa não encontrada.');
      }

      request.tenant = {
        companyId,
        membershipId: '', // suporte não tem membership
        permissions: SUPPORT_PROXY_PERMISSIONS,
        setupStatus: company.setup_status,
      };

      return true;
    }

    // ── Fluxo Normal ──────────────────────────────────────────────────────────
    const membership = await this.prisma.db.memberships.findUnique({
      where: {
        user_id_company_id: {
          user_id: user.id,
          company_id: companyId,
        },
      },
      select: {
        id: true,
        status: true,
        companies: {
          select: { setup_status: true },
        },
        membership_roles: {
          select: {
            roles: {
              select: {
                role_permissions: {
                  where: { is_active: true },
                  select: { permission_code: true },
                },
              },
            },
          },
        },
      },
    });

    if (!membership || membership.status !== 'active') {
      this.logger.warn(`Acesso negado: user=${user.id} tentou acessar company=${companyId}`);
      throw new ForbiddenException('Você não possui acesso ativo a esta empresa.');
    }

    // ── Coletar permissões de todos os roles ──
    const permissions = new Set<string>();
    for (const mr of membership.membership_roles) {
      for (const rp of mr.roles.role_permissions) {
        permissions.add(rp.permission_code);
      }
    }

    // ── Injetar TenantContext no request ──
    request.tenant = {
      companyId,
      membershipId: membership.id,
      permissions: Array.from(permissions),
      setupStatus: membership.companies.setup_status,
    };

    return true;
  }
}