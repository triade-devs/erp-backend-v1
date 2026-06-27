// ── Interfaces ──
export type {
  AuthenticatedUser,
  TenantContext,
  CompanySetupStatus,
} from './interfaces/request-context.interface.js';

// ── Config ──
export { envSchema, validate } from './config/env.validation.js';
export type { EnvConfig } from './config/env.validation.js';

// ── Decorators ──
export { CurrentUser } from './decorators/current-user.decorator.js';
export { CurrentTenant } from './decorators/current-tenant.decorator.js';
export { Public, IS_PUBLIC_KEY } from './decorators/public.decorator.js';
export { SkipTenant, SKIP_TENANT_KEY } from './decorators/skip-tenant.decorator.js';
export { AllowDuringFiscalSetup, ALLOW_DURING_FISCAL_SETUP_KEY } from './decorators/allow-during-fiscal-setup.decorator.js';
export { TenantProtected } from './decorators/tenant-protected.decorator.js';

// ── Guards ──
export { SupabaseAuthGuard } from './guards/supabase-auth.guard.js';
export { SupportAccessGuard } from './guards/support-access.guard.js';
export { TenantGuard } from './guards/tenant.guard.js';
export { CompanyActiveGuard } from './guards/company-active.guard.js';
export { PlatformAdminGuard } from './guards/platform-admin.guard.js';

// ── Constants ──
export { SUPPORT_PROXY_PERMISSIONS } from './constants/support-permissions.constant.js';

// ── Filters ──
export { AllExceptionsFilter } from './filters/all-exceptions.filter.js';

// ── Interceptors ──
export { AuditLoggerInterceptor } from './interceptors/audit-logger.interceptor.js';

// ── Bootstrap ──
export { RouteClassificationChecker } from './bootstrap/route-classification.checker.js';
