// ── Interfaces ──
export type {
  AuthenticatedUser,
  TenantContext,
} from './interfaces/request-context.interface.js';

// ── Config ──
export { envSchema, validate } from './config/env.validation.js';
export type { EnvConfig } from './config/env.validation.js';

// ── Decorators ──
export { CurrentUser } from './decorators/current-user.decorator.js';
export { CurrentTenant } from './decorators/current-tenant.decorator.js';
export { Public, IS_PUBLIC_KEY } from './decorators/public.decorator.js';

// ── Guards ──
export { SupabaseAuthGuard } from './guards/supabase-auth.guard.js';
export { TenantGuard } from './guards/tenant.guard.js';
export { CompanyActiveGuard } from './guards/company-active.guard.js';

// ── Filters ──
export { AllExceptionsFilter } from './filters/all-exceptions.filter.js';

// ── Interceptors ──
export { AuditLoggerInterceptor } from './interceptors/audit-logger.interceptor.js';
