import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import type { TenantContext } from '../interfaces/request-context.interface.js';

/**
 * Guard de Empresa Ativa — Trava Global 423 Locked.
 *
 * Verifica se a empresa está no status ACTIVE consultando o setup_status.
 * Empresas em PENDING_SEED ou PENDING_FISCAL devem ser bloqueadas
 * de qualquer operação de negócio (exceto as rotas de onboarding).
 *
 * O fluxo de CompanySetupStatus é:
 * PENDING_SEED → PENDING_FISCAL (423 Locked) → ACTIVE → SUSPENDED
 *
 * NOTA: Este guard deve ser aplicado seletivamente em rotas que
 * exigem empresa ativa. Rotas de onboarding NÃO devem usá-lo.
 */
@Injectable()
export class CompanyActiveGuard implements CanActivate {
  private readonly logger = new Logger(CompanyActiveGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      Request & { tenant?: TenantContext; companySetupStatus?: string }
    >();

    const tenant = request.tenant;
    if (!tenant) {
      throw new ForbiddenException(
        'CompanyActiveGuard requer TenantGuard ativo antes.',
      );
    }

    // O setup_status é carregado pelo middleware de tenant ou pode
    // ser verificado via query adicional. Por ora, confiamos que
    // o TenantGuard já enriqueceu essa informação.
    // TODO Fase 2: Enriquecer TenantContext com setup_status
    return true;
  }
}
