import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { TenantContext } from '../interfaces/request-context.interface.js';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator.js';

/**
 * PermissionGuard — Checa permissões granulares dentro do tenant.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Ordem na pipeline
 * ─────────────────────────────────────────────────────────────────────────
 *   SupportAccessGuard → TenantGuard → CompanyActiveGuard → PermissionGuard
 *
 * Depende de `request.tenant.permissions` já estar montado pelo TenantGuard.
 * O PermissionGuard NUNCA faz consulta ao banco — trabalha apenas com
 * os dados já resolvidos na memória do request.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Comportamento
 * ─────────────────────────────────────────────────────────────────────────
 * 1. Se a rota NÃO tem @RequirePermission(): passa (sem restrição de código).
 *    Isso mantém compatibilidade com controllers que não precisam de granularidade.
 *
 * 2. Se a rota TEM @RequirePermission(...codes):
 *    - Verifica se `tenant.permissions` contém PELO MENOS UM dos codes (OR).
 *    - Sim → libera.
 *    - Não → 403 com lista dos codes exigidos no log (não exposta ao client).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Decisão de design: OR (não AND)
 * ─────────────────────────────────────────────────────────────────────────
 * A maioria dos endpoints tem exatamente 1 code, tornando OR ≡ AND nesses casos.
 * Em endpoints compostos (ex: aceitos por dois roles distintos), OR é o correto:
 * qualquer role elegível pode executar a ação.
 *
 * Se um endpoint específico exigir AND no futuro, crie um segundo decorator
 * @RequireAllPermissions() — não altere a semântica deste.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // ── 1. Ler metadata do decorator @RequirePermission ───────────────────────
    const requiredCodes = this.reflector.getAllAndOverride<string[] | undefined>(REQUIRE_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Sem decorator → não há restrição de código; passa.
    if (!requiredCodes || requiredCodes.length === 0) {
      return true;
    }

    // ── 2. Garantir que o TenantGuard rodou antes ─────────────────────────────
    const request = context.switchToHttp().getRequest<Request & { tenant?: TenantContext }>();

    const tenant = request.tenant;
    if (!tenant) {
      // Configuração errada: PermissionGuard sem TenantGuard antes.
      // Loga como erro de configuração para facilitar debugging.
      this.logger.error(
        'PermissionGuard executou sem request.tenant. ' +
          'Verifique se @TenantProtected() está aplicado antes de @RequirePermission().',
      );
      throw new ForbiddenException('Contexto de tenant não encontrado.');
    }

    // ── 3. Checagem OR: basta ter qualquer um dos codes ───────────────────────
    const userPermissions = new Set(tenant.permissions);
    const hasAny = requiredCodes.some(code => userPermissions.has(code));

    if (hasAny) {
      return true;
    }

    // ── 4. Negar: logar codes faltantes sem expor ao client ───────────────────
    const missing = requiredCodes.filter(code => !userPermissions.has(code));
    this.logger.warn(
      `Permissão negada: user membership=${tenant.membershipId} ` +
        `company=${tenant.companyId} ` +
        `codes_required=[${requiredCodes.join(', ')}] ` +
        `codes_missing=[${missing.join(', ')}]`,
    );

    throw new ForbiddenException(
      'Você não tem permissão para executar esta ação. ' +
        'Entre em contato com o administrador da empresa para solicitar acesso.',
    );
  }
}