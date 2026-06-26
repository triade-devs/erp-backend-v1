import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import type { EnvConfig } from './common/config/env.validation.js';

/**
 * Bootstrap da aplicação.
 *
 * Pipeline global aplicado na ordem:
 * 1. AllExceptionsFilter  → catch-all de erros
 * 2. SupabaseAuthGuard    → verificação JWT
 * 3. AuditLoggerInterceptor → log de mutações
 * 4. ValidationPipe        → validação de DTOs via class-validator
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  // ── Prefixo global de API ──
  app.setGlobalPrefix('api/v1');

  // ── CORS ──
  app.enableCors({
    origin: true, // Em produção, restringir para domínios específicos
    credentials: true,
  });

  // ── ValidationPipe global (class-validator) ──
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,         // Strip propriedades não-decoradas
      forbidNonWhitelisted: true, // Rejeita propriedades extras
      transform: true,         // Transforma payloads em instâncias de DTO
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ── Porta ──
  const configService = app.get(ConfigService<EnvConfig>);
  const port = configService.get('PORT', { infer: true }) ?? 3000;

  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`🚀 ERP Backend v1 rodando em http://localhost:${port}/api/v1`);
  logger.log(`📋 Ambiente: ${configService.get('NODE_ENV', { infer: true })}`);
}

bootstrap();
