import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { validate } from './common/config/env.validation.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SupabaseAuthGuard } from './common/guards/supabase-auth.guard.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { AuditLoggerInterceptor } from './common/interceptors/audit-logger.interceptor.js';
import { AppController } from './app.controller.js';

/**
 * AppModule — Root da aplicação.
 *
 * Infraestrutura montada:
 * ┌─────────────────────────────────────────────┐
 * │ ConfigModule (global, validado por Zod)      │
 * │ PrismaModule (global, lifecycle gerenciado)  │
 * ├─────────────────────────────────────────────┤
 * │ Guards globais:                              │
 * │   1. SupabaseAuthGuard (JWT HS256)           │
 * │      → Rotas @Public() são bypass            │
 * │      → TenantGuard NÃO é global (use-case)  │
 * ├─────────────────────────────────────────────┤
 * │ Interceptors globais:                        │
 * │   1. AuditLoggerInterceptor (best-effort)    │
 * ├─────────────────────────────────────────────┤
 * │ Filters globais:                             │
 * │   1. AllExceptionsFilter (formato unificado) │
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
  ],
})
export class AppModule {}
