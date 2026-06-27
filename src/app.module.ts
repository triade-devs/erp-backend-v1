import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { validate } from './common/config/env.validation.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SupabaseAuthGuard } from './common/guards/supabase-auth.guard.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { AuditLoggerInterceptor } from './common/interceptors/audit-logger.interceptor.js';
import { RouteClassificationChecker } from './common/bootstrap/route-classification.checker.js';
import { OnboardingModule } from './onboarding/onboarding.module.js';
import { PlatformModule } from './platform/platform.module.js';
import { AppController } from './app.controller.js';

/**
 * AppModule — Root da aplicação.
 *
 * Infraestrutura montada:
 * ┌─────────────────────────────────────────────┐
 * │ ConfigModule (global, validado por Zod)      │
 * │ PrismaModule (global, lifecycle gerenciado)  │
 * ├─────────────────────────────────────────────┤
 * │ Módulos de negócio:                          │
 * │   • OnboardingModule (E1/E2/E3)              │
 * │   • PlatformModule (support grants)          │
 * ├─────────────────────────────────────────────┤
 * │ Guards globais:                              │
 * │   1. SupabaseAuthGuard (JWT HS256)           │
 * │      → Rotas @Public() são bypass            │
 * │      → Rotas de negócio usam @TenantProtected()│
 * │      → Rotas de onboarding usam @SkipTenant()│
 * ├─────────────────────────────────────────────┤
 * │ Interceptors globais:                        │
 * │   1. AuditLoggerInterceptor (best-effort)    │
 * │      → Audita GET de suporte (Fase G)        │
 * ├─────────────────────────────────────────────┤
 * │ Filters globais:                             │
 * │   1. AllExceptionsFilter (formato unificado) │
 * ├─────────────────────────────────────────────┤
 * │ Bootstrap:                                   │
 * │   1. RouteClassificationChecker (Fase D)     │
 * │      → Warning dev / Erro prod em rota órfã  │
 * └─────────────────────────────────────────────┘
 */
@Module({
  imports: [
    // ── Config Global com validação Zod ──
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: ['.env.local', '.env'],
    }),

    // ── Prisma Global ──
    PrismaModule,

    // ── Módulos de negócio ──
    OnboardingModule,
    PlatformModule,
  ],
  controllers: [AppController],
  providers: [
    // ── Guard Global: Auth JWT ──
    {
      provide: APP_GUARD,
      useClass: SupabaseAuthGuard,
    },

    // ── Interceptor Global: Audit Logger ──
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLoggerInterceptor,
    },

    // ── Filter Global: Exception Handler ──
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },

    // ── Bootstrap: Checagem de rotas órfãs (Fase D) ──
    RouteClassificationChecker,
  ],
})
export class AppModule {}