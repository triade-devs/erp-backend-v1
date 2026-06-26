import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  AuthenticatedUser,
  TenantContext,
} from '../interfaces/request-context.interface.js';

/**
 * TenantGuard — Resolução de Tenant via Header `x-company-id`.
 *
 * Fluxo:
 * 1. Lê `x-company-id` do header.
 * 2. Busca membership ativa do usuário naquela empresa.
 * 3. Carrega as permissões via membership_roles → role_permissions.
 * 4. Injeta `TenantContext` no request para uso downstream.
 *
 * Se o usuário não tiver membership ativa na empresa, retorna 403.
 *
 * NOTA: Este guard depende do SupabaseAuthGuard já ter executado
 * (ou seja, `request.user` já está populado).
 */
@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      Request & { user: AuthenticatedUser; tenant?: TenantContext }
    >();

    const user = request.user;
    if (!user) {
      throw new ForbiddenException(
        'TenantGuard requer SupabaseAuthGuard ativo antes.',
      );
    }

    const companyId = request.headers['x-company-id'] as string | undefined;
    if (!companyId) {
      throw new ForbiddenException(
        'Header x-company-id é obrigatório para acessar recursos de tenant.',
      );
    }

    // ── Buscar membership ativa ──
    const membership = await this.prisma.memberships.findUnique({
      where: {
        user_id_company_id: {
          user_id: user.id,
          company_id: companyId,
        },
      },
      select: {
        id: true,
        status: true,
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
      this.logger.warn(
        `Acesso negado: user=${user.id} tentou acessar company=${companyId}`,
      );
      throw new ForbiddenException(
        'Você não possui acesso ativo a esta empresa.',
      );
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
    };

    return true;
  }
}
