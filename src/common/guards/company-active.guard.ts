import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { TenantContext } from '../interfaces/request-context.interface.js';
import { ALLOW_DURING_FISCAL_SETUP_KEY } from '../decorators/allow-during-fiscal-setup.decorator.js';

/**
 * Guard de Empresa Ativa.
 *
 * Verifica o `setup_status` da empresa (carregado pelo TenantGuard) e
 * decide se o request deve prosseguir:
 *
 * | Status          | Resultado                                                    |
 * |-----------------|--------------------------------------------------------------|
 * | ACTIVE          | Libera                                                       |
 * | PENDING_FISCAL  | 423 Locked, exceto rotas marcadas @AllowDuringFiscalSetup()  |
 * | PENDING_SEED    | 403 Forbidden (defesa em profundidade)                        |
 * | SUSPENDED       | 403 Forbidden                                                |
 *
 * NOTA: Depende do TenantGuard já ter executado e populado `request.tenant`.
 */
@Injectable()
export class CompanyActiveGuard implements CanActivate {
  private readonly logger = new Logger(CompanyActiveGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { tenant?: TenantContext }>();

    const tenant = request.tenant;
    if (!tenant) {
      throw new ForbiddenException(
        'CompanyActiveGuard requer TenantGuard ativo antes.',
      );
    }

    const { setupStatus, companyId } = tenant;

    // ── ACTIVE: caminho feliz ─────────────────────────────────────────────────
    if (setupStatus === 'ACTIVE') {
      return true;
    }

    // ── PENDING_FISCAL: 423 com exceção pontual ───────────────────────────────
    if (setupStatus === 'PENDING_FISCAL') {
      const allowDuringFiscal = this.reflector.getAllAndOverride<boolean>(
        ALLOW_DURING_FISCAL_SETUP_KEY,
        [context.getHandler(), context.getClass()],
      );

      if (allowDuringFiscal) {
        return true;
      }

      this.logger.log(
        `Empresa ${companyId} está em PENDING_FISCAL — rota bloqueada (423 Locked).`,
      );
      throw new HttpException(
        {
          statusCode: HttpStatus.LOCKED,
          error: 'Locked',
          message:
            'A empresa ainda não completou o cadastro fiscal. ' +
            'Finalize o preenchimento dos dados fiscais para continuar.',
        },
        HttpStatus.LOCKED,
      );
    }

    // ── PENDING_SEED: defesa em profundidade (não deveria ocorrer com membership) ──
    if (setupStatus === 'PENDING_SEED') {
      this.logger.warn(
        `Empresa ${companyId} está em PENDING_SEED com membership ativo — acesso negado (403).`,
      );
      throw new ForbiddenException(
        'A empresa ainda não foi inicializada. Entre em contato com o suporte.',
      );
    }

    // ── SUSPENDED ─────────────────────────────────────────────────────────────
    this.logger.warn(`Empresa ${companyId} está SUSPENDED — acesso negado (403).`);
    throw new ForbiddenException(
      'O acesso a esta empresa está suspenso. Entre em contato com o suporte.',
    );
  }
}
