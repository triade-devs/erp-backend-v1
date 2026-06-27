import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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
      whitelist: true, // Strip propriedades não-decoradas
      forbidNonWhitelisted: true, // Rejeita propriedades extras
      transform: true, // Transforma payloads em instâncias de DTO
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ── Swagger / OpenAPI ──────────────────────────────────────────────────────
  const configService = app.get(ConfigService<EnvConfig>);
  const nodeEnv = configService.get('NODE_ENV', { infer: true });

  // Expõe o Swagger em todos os ambientes exceto produção.
  // Para expor em produção, remova a condicional ou use uma rota protegida.
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('ERP Backend v1')
      .setDescription(
        '## ERP Modular Multi-tenant — API REST\n\n' +
          'Backend de um ERP modular com isolamento total de dados por empresa via **RLS no PostgreSQL**.\n\n' +
          '### Autenticação\n\n' +
          'Todas as rotas (exceto `@Public()`) exigem o header:\n\n' +
          '```\nAuthorization: Bearer <supabase-jwt>\n```\n\n' +
          'O JWT é emitido pelo **Supabase Auth** e verificado via HS256 com o `SUPABASE_JWT_SECRET`.\n\n' +
          '### Multi-tenant\n\n' +
          'Rotas `@TenantProtected()` exigem também:\n\n' +
          '```\nX-Company-Id: <uuid-da-empresa>\n```\n\n' +
          '### Acesso de Suporte\n\n' +
          'Operadores de suporte incluem adicionalmente:\n\n' +
          '```\nX-Support-Grant: <grant-id>\n```\n\n' +
          '### Classificação de Rotas\n\n' +
          '| Decorator | Comportamento |\n' +
          '|---|---|\n' +
          '| `@Public()` | Sem autenticação |\n' +
          '| `@SkipTenant()` | JWT obrigatório, sem contexto de empresa |\n' +
          '| `@TenantProtected()` | JWT + X-Company-Id + membership ativo + empresa ACTIVE |',
      )
      .setVersion('1.0.0')
      .setContact('ERP Team', '', '')
      .setLicense('Privado', '')
      // Esquema de autenticação JWT Bearer (Supabase)
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'JWT emitido pelo Supabase Auth. ' +
            'Obtenha-o via `supabase.auth.signInWithPassword()` ou qualquer provider configurado.',
          in: 'header',
          name: 'Authorization',
        },
        'supabase-jwt',
      )
      // Header de tenant
      .addApiKey(
        {
          type: 'apiKey',
          in: 'header',
          name: 'X-Company-Id',
          description:
            'UUID da empresa (tenant). Obrigatório para rotas @TenantProtected(). ' +
            'Exemplo: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        },
        'company-id',
      )
      // Header de suporte
      .addApiKey(
        {
          type: 'apiKey',
          in: 'header',
          name: 'X-Support-Grant',
          description:
            'UUID do support grant ativo. Presente apenas em chamadas de operadores de suporte. ' +
            'Válido por 15 minutos. Obtido via POST /platform/support-grants.',
        },
        'support-grant',
      )
      .addTag('Onboarding', 'As três portas de entrada: criar empresa, dados fiscais e aceite de convite.')
      .addTag('Platform (Admin Interno)', 'Operações administrativas da plataforma. Exclusivo para platform_admins.')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);

    SwaggerModule.setup('api/v1/docs', app, document, {
      // Remove o prefixo global para o Swagger não duplicar o path
      useGlobalPrefix: false,
      swaggerOptions: {
        // Persiste a autorização entre reloads da página
        persistAuthorization: true,
        // Expande todas as tags por padrão
        docExpansion: 'list',
        // Ordena endpoints por método HTTP
        operationsSorter: 'method',
        // Mostra o tempo de cada requisição
        displayRequestDuration: true,
        // Filtra endpoints por tag ou path
        filter: true,
        // Agrupa os schemas no final
        tagsSorter: 'alpha',
        // Não mostra o header de "swagger" extra
        deepLinking: true,
      },
      customSiteTitle: 'ERP Backend v1 — API Docs',
      customCss: `
        .swagger-ui .topbar { background-color: #1a1a2e; }
        .swagger-ui .topbar .topbar-wrapper .link { visibility: hidden; }
        .swagger-ui .topbar .topbar-wrapper::before {
          content: 'ERP Backend v1';
          color: #e2e8f0;
          font-size: 1.2rem;
          font-weight: 700;
          font-family: system-ui, sans-serif;
          visibility: visible;
        }
        .swagger-ui .info .title { color: #1a1a2e; }
        .swagger-ui .btn.authorize { background-color: #16a34a; border-color: #16a34a; }
        .swagger-ui .btn.authorize svg { fill: #fff; }
      `,
    });

    const logger = new Logger('Swagger');
    logger.log(
      `📚 Swagger disponível em http://localhost:${configService.get('PORT', { infer: true }) ?? 3000}/api/v1/docs`,
    );
  }
  // ────────────────────────────────────────────────────────────────────────────

  // ── Porta ──
  const port = configService.get('PORT', { infer: true }) ?? 3000;

  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`🚀 ERP Backend v1 rodando em http://localhost:${port}/api/v1`);
  logger.log(`📋 Ambiente: ${nodeEnv}`);
}

void bootstrap();