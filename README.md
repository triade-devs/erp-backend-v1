# ERP Backend v1

> Backend de um ERP modular multi-tenant construído com **NestJS + TypeScript + PostgreSQL (Supabase)**.  
> Cada empresa cliente tem seus dados completamente isolados por RLS no banco.  
> Autenticação via Supabase Auth (JWT HS256). RBAC granular por empresa.

---

## Índice

1. [O que este backend entrega](#1-o-que-este-backend-entrega)
2. [Stack & Tecnologias](#2-stack--tecnologias)
3. [Pré-requisitos](#3-pré-requisitos)
4. [Configuração local](#4-configuração-local)
5. [Como rodar](#5-como-rodar)
6. [Estrutura do projeto](#6-estrutura-do-projeto)
7. [Como funciona — Arquitetura](#7-como-funciona--arquitetura)
8. [Segurança em camadas](#8-segurança-em-camadas)
9. [Onboarding de empresa](#9-onboarding-de-empresa)
10. [Acesso de suporte](#10-acesso-de-suporte)
11. [Endpoints disponíveis](#11-endpoints-disponíveis)
12. [Documentação complementar](#12-documentação-complementar)

---

## 1. O que este backend entrega

| Domínio | O que faz |
|---|---|
| **Multi-tenant** | Cada empresa só acessa os próprios dados. Garantido no banco (RLS), nunca só na tela. |
| **Auth / Onboarding** | Autenticação Supabase. Três portas de entrada: criar empresa, preencher dados fiscais, aceitar convite. |
| **RBAC granular** | Cada cargo tem um conjunto de permissões; a empresa pode ajustar as permissões do cargo dela. |
| **Plataforma (suporte)** | Time interno cria empresas, define planos, libera módulos, e entra numa empresa por tempo limitado com registro total na auditoria. |
| **Auditoria** | Registra quem fez o que, quando, com metadata JSON (antes/depois). |
| **Estoque FIFO** | *(roadmap)* Cada entrada vira um lote com custo; cada saída consome do lote mais antigo, calculando lucro exato. |
| **Enriquecimento** | *(existente, mantido)* Serviço separado (JWKS/ES256) para CNPJ, CEP, NCM e EAN. |

---

## 2. Stack & Tecnologias

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js 22+ |
| Framework | NestJS 10+ |
| Linguagem | TypeScript (strict) |
| Banco de dados | PostgreSQL via Supabase |
| ORM | Prisma |
| Autenticação | Supabase Auth — JWT HS256 verificado manualmente |
| Validação de DTOs | class-validator + class-transformer |
| Validação de env | Zod |
| Lint | ESLint + Prettier |

---

## 3. Pré-requisitos

- **Node.js** ≥ 22.x
- **npm** ≥ 10.x
- Projeto no **Supabase** (Postgres + Auth configurados)
- Variáveis de ambiente preenchidas (ver seção abaixo)

---

## 4. Configuração local

### 4.1 Instalar dependências

```bash
npm install
```

### 4.2 Variáveis de ambiente

Copie o exemplo e preencha com seus valores:

```bash
cp .env.example .env.local
```

**`.env.example`** com todas as variáveis:

```env
# ── Database (Supabase PostgreSQL) ───────────────────────────
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres"

# ── Supabase Auth ─────────────────────────────────────────────
SUPABASE_URL="https://[PROJECT_REF].supabase.co"
SUPABASE_ANON_KEY="eyJ..."
SUPABASE_JWT_SECRET="your-jwt-secret-at-least-32-chars-long"

# ── App ───────────────────────────────────────────────────────
PORT=3000
NODE_ENV=development

# ── Platform / Support ────────────────────────────────────────
# Quando 'true', exige MFA (aal2) para criar support grants.
# Ativar SOMENTE quando platform_admins tiverem MFA configurado.
SUPPORT_MFA_ENFORCED=false
```

> **Importante:** `SUPABASE_JWT_SECRET` é o segredo HS256 do seu projeto Supabase.  
> Encontrado em: *Dashboard → Project Settings → API → JWT Secret*.

### 4.3 Gerar o Prisma Client

```bash
npx prisma generate
```

### 4.4 Aplicar as migrations

```bash
npx prisma migrate deploy
```

---

## 5. Como rodar

```bash
# Desenvolvimento (watch mode)
npm run start:dev

# Produção (após build)
npm run build
npm run start:prod

# Build apenas
npm run build
```

A API estará disponível em: `http://localhost:3000/api/v1`

### Documentação interativa (Swagger)

Em ambiente de desenvolvimento, o Swagger UI fica em:

```
http://localhost:3000/api/v1/docs
```

> Em produção (`NODE_ENV=production`) o Swagger é desabilitado automaticamente.

Para autenticar no Swagger UI:
1. Clique no botão **Authorize** 🔓
2. No campo `supabase-jwt (Bearer)`, cole seu JWT do Supabase
3. Opcionalmente preencha `company-id` (X-Company-Id) para rotas de tenant
4. Clique **Authorize** e feche o modal

### Scripts disponíveis

| Comando | O que faz |
|---|---|
| `npm run start:dev` | Inicia com hot-reload (nodemon) |
| `npm run start:prod` | Inicia o build compilado |
| `npm run build` | Compila TypeScript → `dist/` |
| `npm run lint` | ESLint em todos os arquivos `.ts` |
| `npm run test` | Roda os testes unitários |
| `npm run test:e2e` | Roda os testes E2E |
| `npm run test:cov` | Cobertura de testes |

---

## 6. Estrutura do projeto

```
src/
├── main.ts                          # Bootstrap: porta, CORS, ValidationPipe
├── app.module.ts                    # Root module: imports, guards globais, interceptors
│
├── common/                          # Infraestrutura transversal (sem regra de negócio)
│   ├── bootstrap/
│   │   └── route-classification.checker.ts   # Garante que toda rota tem classificação de segurança
│   ├── config/
│   │   └── env.validation.ts                 # Schema Zod de validação de envs
│   ├── constants/
│   │   └── support-permissions.constant.ts   # Permissões fixas do modo suporte
│   ├── decorators/
│   │   ├── allow-during-fiscal-setup.decorator.ts  # Exceção para PENDING_FISCAL
│   │   ├── current-tenant.decorator.ts             # Injeta TenantContext do request
│   │   ├── current-user.decorator.ts               # Injeta AuthenticatedUser do request
│   │   ├── public.decorator.ts                     # Marca rota como pública (sem auth)
│   │   ├── skip-tenant.decorator.ts                # Auth sem resolução de tenant
│   │   └── tenant-protected.decorator.ts           # Compõe a pilha completa de guards
│   ├── filters/
│   │   └── all-exceptions.filter.ts          # Formato unificado de erros
│   ├── guards/
│   │   ├── company-active.guard.ts            # Bloqueia empresa suspensa/não-configurada
│   │   ├── platform-admin.guard.ts            # Restringe a platform_admins
│   │   ├── supabase-auth.guard.ts             # Verifica JWT HS256 do Supabase
│   │   ├── support-access.guard.ts            # Valida X-Support-Grant
│   │   └── tenant.guard.ts                    # Resolve tenant e membership
│   ├── interceptors/
│   │   └── audit-logger.interceptor.ts        # Audita mutações + GETs de suporte
│   └── interfaces/
│       └── request-context.interface.ts       # Tipos de AuthenticatedUser e TenantContext
│
├── onboarding/                      # As três portas de entrada no sistema
│   ├── dto/
│   │   ├── accept-invitation.dto.ts
│   │   ├── create-company.dto.ts
│   │   └── update-fiscal-data.dto.ts
│   ├── onboarding.controller.ts
│   ├── onboarding.module.ts
│   └── onboarding.service.ts
│
├── platform/                        # Operações administrativas de plataforma
│   ├── dto/
│   │   └── create-support-grant.dto.ts
│   ├── platform.controller.ts
│   ├── platform.module.ts
│   └── platform.service.ts
│
└── prisma/                          # Acesso ao banco
    ├── prisma.module.ts
    └── prisma.service.ts
```

---

## 7. Como funciona — Arquitetura

### 7.1 Multi-tenancy

O isolamento entre empresas é feito por **Row Level Security (RLS) no PostgreSQL**. Toda tabela de dados de cliente tem `company_id NOT NULL` e políticas RLS que garantem que uma empresa nunca enxerga os dados de outra.

O backend resolve o contexto de tenant em cada request via `TenantGuard`, que:
1. Lê o header `X-Company-Id`
2. Verifica que o usuário autenticado tem `membership` ativo nessa empresa
3. Carrega o `setup_status` da empresa
4. Injeta o `TenantContext` no request

### 7.2 RBAC granular

```
Permission (código global) → Role (por empresa) → Membership (User × Company)
```

- **Permissões** são atômicas e seguem o padrão `<modulo>:<recurso>:<ação>` (ex: `inventory:product:create`)
- **Roles** são por empresa. Ao criar uma empresa, três roles-padrão são geradas: `owner`, `manager`, `operator`
- **Memberships** vinculam usuário ↔ empresa. Um usuário pode ter múltiplas empresas. Um membro pode ter múltiplas roles.
- A permissão efetiva é a **união** de todas as roles do membro na empresa

### 7.3 Pipeline de guards por tipo de rota

```
Toda request JWT válida →
  ├── @Public()            → Libera sem auth (ex: healthcheck)
  ├── @SkipTenant()        → Autenticado, sem resolver tenant (onboarding, platform)
  └── @TenantProtected()   → Pilha completa:
        SupportAccessGuard  → valida X-Support-Grant (se presente)
        TenantGuard         → resolve company + membership
        CompanyActiveGuard  → bloqueia empresa não-ativa
```

### 7.4 Status de setup da empresa

| `setup_status` | Significado | Acesso |
|---|---|---|
| `PENDING_SEED` | Empresa criada mas sem seed de roles | **403** — contato equipe interna |
| `PENDING_FISCAL` | Aguardando dados fiscais | **423** — apenas rota `@AllowDuringFiscalSetup()` |
| `ACTIVE` | Empresa operacional | ✅ Normal |
| `SUSPENDED` | Empresa suspensa | **403** |

### 7.5 Auditoria

O `AuditLoggerInterceptor` registra automaticamente:
- **Toda mutação** (POST, PUT, PATCH, DELETE) de qualquer usuário
- **GETs de operadores de suporte** (`isSupportProxy === true`) — leitura em contexto de suporte é ação sensível

---

## 8. Segurança em camadas

| Camada | Mecanismo |
|---|---|
| **1 — Auth** | `SupabaseAuthGuard` verifica JWT HS256. Falha → 401. |
| **2 — Tenant** | `TenantGuard` exige membership ativo. Ausente → 403. |
| **3 — Status** | `CompanyActiveGuard` bloqueia empresas não-ativas. |
| **4 — Suporte** | `SupportAccessGuard` valida grant temporário (15min). |
| **5 — Platform** | `PlatformAdminGuard` restringe a `platform_admins`. |
| **6 — RLS** | Postgres bloqueia qualquer query fora do tenant. Última linha de defesa. |
| **7 — Auditoria** | Tudo fica registrado. Tabela append-only (sem UPDATE/DELETE). |

### Classificação obrigatória de rotas

O `RouteClassificationChecker` roda no boot da aplicação e verifica que **toda rota** tem exatamente uma das classificações:

- `@Public()` — acessível sem autenticação
- `@SkipTenant()` — autenticada, sem contexto de empresa
- `@TenantProtected()` — pipeline completo de guards

Em produção (`NODE_ENV=production`), uma rota não classificada **impede a inicialização do servidor**.

---

## 9. Onboarding de empresa

O onboarding tem três endpoints (`POST /api/v1/onboarding/...`):

### E1 — Criar empresa (self-service)

```http
POST /api/v1/onboarding/companies
Authorization: Bearer <JWT>

{
  "name": "Acme Corporation",
  "slug": "acme",
  "planCode": "starter"
}
```

Em transação atômica:
1. Cria a empresa com `setup_status = PENDING_SEED`
2. Cria roles padrão (`owner`, `manager`, `operator`) com permissões
3. Cria `company_settings` (moeda BRL, fuso São Paulo)
4. Cria classificação raiz `"GERAL"`
5. Vincula o usuário como administrador (`ACTIVE`)
6. Avança para `setup_status = PENDING_FISCAL`

### E2 — Dados fiscais (PENDING_FISCAL → ACTIVE)

```http
PATCH /api/v1/onboarding/companies/:id/fiscal-data
Authorization: Bearer <JWT>
X-Company-Id: <company-uuid>

{
  "document": "12.345.678/0001-90",
  "tradeName": "Acme Corp Ltda"
}
```

Finaliza o setup. Empresa passa para `ACTIVE`.

### E3 — Aceitar convite

```http
POST /api/v1/onboarding/invitations/:shortCode/accept
Authorization: Bearer <JWT>

{
  "token": "<token-do-email>"
}
```

O `token` é validado por hash (não armazenado em plaintext). Em transação atômica:
1. Valida o convite (expiração, status)
2. Cria ou atualiza o membership do usuário
3. Atribui as roles do convite

---

## 10. Acesso de suporte

O acesso de suporte permite que um membro da equipe interna entre em uma empresa cliente por **até 15 minutos**, com rastreamento total.

### Fluxo

```
1. Platform Admin A → cria um grant para o Platform Admin B
   POST /api/v1/platform/support-grants
   { support_user_id, company_id, reason }
   → retorna { grantId, expiresAt }

2. Platform Admin B → usa o grantId como header nas chamadas
   GET /api/v1/...
   X-Support-Grant: <grantId>
   X-Company-Id: <company-id>

3. Tudo que B faz durante o grant é auditado com isSupportProxy=true
4. Após 15 minutos, o grant expira automaticamente
```

### Garantias de segurança

- **Regra de quatro olhos:** `support_user_id !== granted_by` (você não pode criar um grant para si mesmo)
- **MFA condicional:** com `SUPPORT_MFA_ENFORCED=true`, exige `aal2` (autenticador TOTP) para criar grants
- **`expires_at` calculado no servidor:** cliente nunca envia a duração
- **Permissões fixas de suporte:** definidas em `SUPPORT_PROXY_PERMISSIONS` (leitura ampla, sem escrita destrutiva por padrão)

---

## 11. Endpoints disponíveis

Prefixo global: `/api/v1`

### Onboarding

| Método | Rota | Guard | Descrição |
|---|---|---|---|
| `POST` | `/onboarding/companies` | `@SkipTenant()` | Criar empresa + seed |
| `PATCH` | `/onboarding/companies/:id/fiscal-data` | `@TenantProtected()` + `@AllowDuringFiscalSetup()` | Finalizar dados fiscais |
| `POST` | `/onboarding/invitations/:shortCode/accept` | `@SkipTenant()` | Aceitar convite |

### Platform (somente platform_admins)

| Método | Rota | Guard | Descrição |
|---|---|---|---|
| `POST` | `/platform/support-grants` | `@SkipTenant()` + `PlatformAdminGuard` | Criar grant de suporte |

---

## 12. Documentação complementar

| Documento | Conteúdo |
|---|---|
| [`docs/Sobre.md`](docs/Sobre.md) | Visão geral do produto, modelo de dados completo, regras de negócio |
| [`docs/ARCHITECTURE-MULTITENANT.md`](docs/ARCHITECTURE-MULTITENANT.md) | Arquitetura multi-tenant, DDL completo, políticas RLS, RBAC detalhado |
| [`docs/plan-auth-onboarding.md`](docs/plan-auth-onboarding.md) | Plano de implementação do Auth + Onboarding (Fases A→G) |
| [`docs/FLUXOS.md`](docs/FLUXOS.md) | Mapeamento de todos os fluxos da aplicação e permissões necessárias |
| [`docs/ONBOARDING-PLAYBOOK.md`](docs/ONBOARDING-PLAYBOOK.md) | Passo a passo operacional para provisionar um novo cliente |
| [`docs/PLAN.md`](docs/PLAN.md) | Plano de implementação geral do ERP (MVP e roadmap) |
| [`docs/PRICING-PLAN.md`](docs/PRICING-PLAN.md) | Estratégia de precificação e blueprint técnico do módulo `billing` |

---

## Convenções

### Classificação de rotas (obrigatório)

Toda rota **deve** ter exatamente um dos decoradores:

```typescript
@Public()           // sem autenticação
@SkipTenant()       // autenticado, sem tenant
@TenantProtected()  // pipeline completo: Auth + Tenant + CompanyActive
```

### Erros padronizados

O `AllExceptionsFilter` garante formato unificado:

```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Você não tem permissão para acessar este recurso.",
  "timestamp": "2026-06-27T18:00:00.000Z",
  "path": "/api/v1/..."
}
```

### DTOs e validação

- Todo payload de entrada é validado por `class-validator` via `ValidationPipe` global
- Propriedades não decoradas são rejeitadas (`forbidNonWhitelisted: true`)
- Payloads são transformados em instâncias de DTO (`transform: true`)

---

## Licença

Privado — uso interno.
