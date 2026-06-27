import { SetMetadata } from '@nestjs/common';

/**
 * Chave de metadata para rotas que rodam autenticadas mas sem tenant resolvido.
 * Usada pelo módulo de onboarding (criação de empresa, aceite de convite).
 */
export const SKIP_TENANT_KEY = 'skipTenant';

/**
 * Decorator `@SkipTenant()`.
 *
 * Sinaliza que a rota não precisa de tenant resolvido (sem x-company-id),
 * mas ainda exige autenticação via SupabaseAuthGuard.
 *
 * Uso exclusivo nas rotas de onboarding (Fase E).
 * A checagem de boot (Fase D) garante que toda rota tem exatamente uma
 * classificação: @Public(), @SkipTenant() ou @TenantProtected().
 *
 * @example
 * ```ts
 * @SkipTenant()
 * @Post('companies')
 * createCompany() { ... }
 * ```
 */
export const SkipTenant = () => SetMetadata(SKIP_TENANT_KEY, true);
