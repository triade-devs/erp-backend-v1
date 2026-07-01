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
          '---\n\n' +
          '### 🔐 Autenticação\n\n' +
          'Todas as rotas (exceto `@Public()`) exigem o header:\n\n' +
          '```\nAuthorization: Bearer <supabase-jwt>\n```\n\n' +
          'O JWT é emitido pelo **Supabase Auth** e verificado via HS256 com o `SUPABASE_JWT_SECRET`.\n\n' +
          '### 🏢 Multi-tenant\n\n' +
          'Rotas `@TenantProtected()` exigem também:\n\n' +
          '```\nX-Company-Id: <uuid-da-empresa>\n```\n\n' +
          '### 🛡️ Acesso de Suporte\n\n' +
          'Operadores de suporte incluem adicionalmente:\n\n' +
          '```\nX-Support-Grant: <grant-id>\n```\n\n' +
          '### 📋 Classificação de Rotas\n\n' +
          '| Decorator | Comportamento |\n' +
          '|---|---|\n' +
          '| `@Public()` | Sem autenticação |\n' +
          '| `@SkipTenant()` | JWT obrigatório, sem contexto de empresa |\n' +
          '| `@TenantProtected()` | JWT + X-Company-Id + membership ativo + empresa ACTIVE |\n\n' +
          '---\n\n' +
          '### 🧪 Como Testar a API (Passo a Passo)\n\n' +
          '#### Pré-requisitos\n\n' +
          '1. Servidor rodando: `npm run start:dev`\n' +
          '2. Um usuário cadastrado no Supabase Auth do projeto\n' +
          '3. Uma empresa criada via onboarding (E1 + E2)\n\n' +
          '#### Passo 1 — Obter JWT\n\n' +
          'Usando o Supabase client (JS, cURL ou Postman):\n\n' +
          '```bash\n' +
          'curl -X POST "https://<PROJECT_REF>.supabase.co/auth/v1/token?grant_type=password" \\\n' +
          '  -H "apikey: <SUPABASE_ANON_KEY>" \\\n' +
          '  -H "Content-Type: application/json" \\\n' +
          '  -d \'{"email": "dev@empresa.com", "password": "sua-senha"}\'\n' +
          '```\n\n' +
          'Copie o campo `access_token` da resposta — este é o seu JWT.\n\n' +
          '#### Passo 2 — Autenticar no Swagger\n\n' +
          '1. Clique em **Authorize** 🔓\n' +
          '2. Em `supabase-jwt`, cole o `access_token`\n' +
          '3. Em `company-id`, cole o UUID da empresa\n' +
          '4. Clique **Authorize** e feche\n\n' +
          '#### Passo 3 — Criar empresa (se ainda não tem)\n\n' +
          '```\n' +
          'POST /onboarding/companies  →  retorna { companyId }\n' +
          'PATCH /onboarding/companies/:id/fiscal-data  →  ativa a empresa\n' +
          '```\n\n' +
          '#### Passo 4 — Testar os módulos de Estoque\n\n' +
          '**Fluxo recomendado de testes (ordem):**\n\n' +
          '```\n' +
          '1. POST /suppliers              → Criar fornecedor\n' +
          '2. POST /inventory/classifications → Criar departamento (level: "department")\n' +
          '3. POST /inventory/classifications → Criar categoria (level: "category", parent_id: <dept-id>)\n' +
          '4. POST /inventory/products     → Criar produto (com classification_id e barcode)\n' +
          '5. POST /movements              → Entrada (type: "in", unit_cost + quantity)\n' +
          '6. POST /movements              → Saída FIFO (type: "out", quantity)\n' +
          '7. GET  /movements/:id          → Verificar consumo por lote\n' +
          '8. GET  /inventory/products/:id  → Verificar saldo atualizado\n' +
          '```\n\n' +
          '> **Dica:** Teste cada endpoint individualmente antes de testar o fluxo completo.\n' +
          '> O Swagger mostra exemplos de payload em cada endpoint — clique em "Try it out".',
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
      .addTag('Suppliers (Fornecedores)', 'CRUD de fornecedores com autopreenchimento por CNPJ.')
      .addTag('Inventory - Classifications', 'Árvore de classificações de produto (department → category → brand).')
      .addTag('Inventory - Products', 'CRUD de produtos com enriquecimento por EAN/NCM e histórico de preço.')
      .addTag('Inventory - Change Requests', 'Fila de câmera: operador submete, gerente aprova/rejeita com transação ACID.')
      .addTag('Movements (Movimentações)', 'Motor FIFO de movimentação de estoque (entrada, saída, ajuste, perda).')
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