import { SetMetadata } from '@nestjs/common';

/**
 * Chave de metadata para rotas liberadas durante o status PENDING_FISCAL.
 */
export const ALLOW_DURING_FISCAL_SETUP_KEY = 'allowDuringFiscalSetup';

/**
 * Decorator `@AllowDuringFiscalSetup()`.
 *
 * Libera uma rota específica para empresas no status PENDING_FISCAL
 * (que normalmente recebem 423 Locked pelo CompanyActiveGuard).
 *
 * Uso exclusivo no endpoint E2 de onboarding fiscal (PATCH /companies/:id/fiscal-data).
 * Aplicado **em conjunto** com @TenantProtected() — o guard lê este metadata
 * para abrir a exceção pontual.
 *
 * @example
 * ```ts
 * @AllowDuringFiscalSetup()
 * @TenantProtected()
 * @Patch(':id/fiscal-data')
 * updateFiscalData() { ... }
 * ```
 */
export const AllowDuringFiscalSetup = () =>
  SetMetadata(ALLOW_DURING_FISCAL_SETUP_KEY, true);
