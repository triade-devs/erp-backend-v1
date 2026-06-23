# Arquitetura Multi-Tenant + RBAC Granular

> **Stack:** Next.js (App Router · Server Actions · TypeScript `strict`) · Supabase (Postgres + Auth + RLS) · Zod
> **Estratégia Multi-tenant:** _Shared Database · Shared Schema · Row-Level Security por `company_id`_
> **Modelo RBAC:** Permissões como linhas (`permissions`) → ligadas a Roles (`role_permissions`) → atribuídas ao usuário **por empresa** (`memberships`).
> **Autor:** Yuri · **Criado em:** 2026-04-20

---

## Sumário

1. [Visão Geral Arquitetural](#1-visão-geral-arquitetural)
2. [Modelo de Dados](#2-modelo-de-dados)
3. [Estratégia Multi-tenant e Isolamento via RLS](#3-estratégia-multi-tenant-e-isolamento-via-rls)
4. [Hierarquia de Permissões (RBAC)](#4-hierarquia-de-permissões-rbac)
5. [Fluxos de Provisionamento](#5-fluxos-de-provisionamento)
6. [Validação de Permissões no Backend](#6-validação-de-permissões-no-backend)
7. [Auditoria de Acessos](#7-auditoria-de-acessos)
8. [Exemplo Prático: Estoque e Movimentações](#8-exemplo-prático-estoque-e-movimentações)
9. [Adicionando um Novo Módulo (Financeiro)](#9-adicionando-um-novo-módulo-financeiro)
10. [Convenções, Padrões de Mercado e Checklist](#10-convenções-padrões-de-mercado-e-checklist)

---

## 1. Visão Geral Arquitetural

### 1.1 Conceitos centrais

| Conceito             | Definição                                                                                                    |
| :------------------- | :----------------------------------------------------------------------------------------------------------- |
| **Global Admin**     | Usuário do time interno (operador do SaaS) com `is_platform_admin = true`. Cria empresas e habilita módulos. |
| **Company (Tenant)** | Organização cliente. Unidade de isolamento de dados.                                                         |
| **User**             | Identidade única (auth.users do Supabase). Pode pertencer a várias empresas.                                 |
| **Module**           | Funcionalidade plugável do ERP (ex: `inventory`, `movements`, `finance`). Registro declarativo.              |
| **Permission**       | Ação atômica de um módulo (ex: `inventory:product:create`).                                                  |
| **Role**             | Agrupamento de permissões **escopo da empresa** (ex: "Gerente de Estoque").                                  |
| **Membership**       | Vínculo `User × Company` com uma ou mais `Roles`. É a tabela-chave do RBAC.                                  |
| **Company Module**   | Empresa X tem o módulo Y habilitado (provisionamento).                                                       |

### 1.2 Diagrama (alto nível)

```
           ┌────────────────┐
           │ Global Admin   │
           └────────┬───────┘
                    │ cria
                    ▼
┌─────────────────────────────────────────┐
│              Company (Tenant)           │
│  id · name · slug · is_active · plan    │
└──┬──────────────────────────────┬───────┘
   │ habilita                     │ possui
   ▼                              ▼
┌─────────────────┐         ┌───────────────────┐
│ company_modules │         │ roles (por cia)   │──┐
│ company_id +    │         │ id · name ·       │  │ possui
│ module_code     │         │ company_id        │  │
└────────┬────────┘         └─────────┬─────────┘  │
         │ referencia                 │ tem        ▼
         ▼                            ▼     ┌──────────────────┐
┌─────────────────┐              ┌───────────────────────┐  permissions
│ modules (cat.)  │              │ role_permissions      │  id·code·module
│ code · name ·   │              │ role_id·permission_id │
│ is_system       │              └───────────────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ permissions     │
│ code(PK) module │
└─────────────────┘

┌─────────────────┐      ┌──────────────────────────────┐
│ auth.users      │◄─────│ memberships                  │──► roles
│ (Supabase Auth) │      │ user_id · company_id · role_ │
└─────────────────┘      │  id · status · is_owner      │
                         └──────────────────────────────┘
```

### 1.3 Princípios

- **Tenant-first:** toda linha de dado de cliente carrega `company_id NOT NULL`.
- **RLS é a lei:** isolamento entre tenants é responsabilidade do Postgres, nunca do código TS.
- **RBAC declarativo:** módulos e permissões são **seed** (dados), não código hardcoded.
- **Extensibilidade > performance inicial:** prefira normalização; indexe depois.
- **UUID v4** em todas as PKs (`gen_random_uuid()`) — evita colisão entre tenants e facilita import/export.
- **Auditoria imutável:** tabela `audit_logs` append-only.

---

## 2. Modelo de Dados

### 2.1 DDL completo

```sql
-- ============================================================
-- EXTENSÕES
-- ============================================================
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. COMPANIES (Tenants)
-- ============================================================
create table public.companies (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  document     text,                               -- CNPJ
  plan         text not null default 'starter',    -- starter|pro|enterprise
  is_active    boolean not null default true,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index idx_companies_slug on public.companies(slug);

-- ============================================================
-- 2. PLATFORM ADMINS (flag global — time interno do SaaS)
-- ============================================================
create table public.platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now()
);

-- ============================================================
-- 3. MODULES (catálogo declarativo)
-- ============================================================
create table public.modules (
  code         text primary key,        -- 'inventory', 'movements', 'finance'
  name         text not null,           -- 'Estoque'
  description  text,
  icon         text,                    -- lucide icon name
  is_system    boolean not null default false,   -- módulos obrigatórios
  is_active    boolean not null default true,
  sort_order   int not null default 100,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- 4. PERMISSIONS (catálogo global de permissões atômicas)
-- ============================================================
create table public.permissions (
  code         text primary key,        -- 'inventory:product:create'
  module_code  text not null references public.modules(code) on delete cascade,
  resource     text not null,           -- 'product', 'movement'
  action       text not null,           -- 'create', 'read', 'update', 'delete'
  description  text,
  created_at   timestamptz not null default now()
);
create index idx_permissions_module on public.permissions(module_code);

-- ============================================================
-- 5. COMPANY_MODULES (provisionamento)
-- ============================================================
create table public.company_modules (
  company_id   uuid not null references public.companies(id) on delete cascade,
  module_code  text not null references public.modules(code) on delete restrict,
  enabled_at   timestamptz not null default now(),
  enabled_by   uuid references auth.users(id),
  primary key (company_id, module_code)
);

-- ============================================================
-- 6. ROLES (por empresa)
-- ============================================================
create table public.roles (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  code         text not null,                          -- 'manager', 'operator'
  name         text not null,                          -- 'Gerente de Estoque'
  description  text,
  is_system    boolean not null default false,         -- role semente não editável
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (company_id, code)
);
create index idx_roles_company on public.roles(company_id);

-- ============================================================
-- 7. ROLE_PERMISSIONS
-- ============================================================
create table public.role_permissions (
  role_id          uuid not null references public.roles(id) on delete cascade,
  permission_code  text not null references public.permissions(code) on delete cascade,
  granted_at       timestamptz not null default now(),
  primary key (role_id, permission_code)
);

-- ============================================================
-- 8. MEMBERSHIPS (User × Company × Roles)
-- ============================================================
create type public.membership_status as enum ('invited', 'active', 'suspended');

create table public.memberships (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  company_id    uuid not null references public.companies(id) on delete cascade,
  is_owner      boolean not null default false,
  status        public.membership_status not null default 'active',
  invited_by    uuid references auth.users(id),
  invited_at    timestamptz,
  joined_at     timestamptz default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, company_id)
);
create index idx_memberships_user    on public.memberships(user_id);
create index idx_memberships_company on public.memberships(company_id);

-- ============================================================
-- 9. MEMBERSHIP_ROLES (N↔M: um membro pode ter várias roles na mesma cia)
-- ============================================================
create table public.membership_roles (
  membership_id  uuid not null references public.memberships(id) on delete cascade,
  role_id        uuid not null references public.roles(id) on delete cascade,
  assigned_by    uuid references auth.users(id),
  assigned_at    timestamptz not null default now(),
  primary key (membership_id, role_id)
);

-- ============================================================
-- 10. AUDIT_LOGS (append-only)
-- ============================================================
create table public.audit_logs (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid references public.companies(id) on delete set null,
  actor_user_id  uuid references auth.users(id),
  actor_email    text,
  action         text not null,                 -- 'product.create', 'membership.grant'
  resource_type  text,
  resource_id    text,
  permission     text,                          -- 'inventory:product:create'
  status         text not null default 'success', -- success|denied|error
  ip             inet,
  user_agent     text,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index idx_audit_logs_company on public.audit_logs(company_id, created_at desc);
create index idx_audit_logs_actor   on public.audit_logs(actor_user_id, created_at desc);

-- audit_logs: ninguém pode UPDATE/DELETE
revoke update, delete on public.audit_logs from public, authenticated;
```

### 2.2 Resumo das tabelas

| Tabela             | PK                 | Papel                     | Escopo |
| :----------------- | :----------------- | :------------------------ | :----- |
| `companies`        | uuid               | Tenant raiz               | global |
| `platform_admins`  | user_id            | Flag de admin do SaaS     | global |
| `modules`          | code (text)        | Catálogo de módulos       | global |
| `permissions`      | code (text)        | Catálogo de permissões    | global |
| `company_modules`  | (company, module)  | Provisionamento           | tenant |
| `roles`            | uuid               | Função escopada à empresa | tenant |
| `role_permissions` | (role, perm)       | O que a role pode fazer   | tenant |
| `memberships`      | uuid               | Vínculo User↔Company      | tenant |
| `membership_roles` | (membership, role) | Roles do membro na cia    | tenant |
| `audit_logs`       | uuid               | Trilha imutável           | tenant |

> **Por que `permissions.code` é text e não uuid?** O código é o identificador semântico usado no backend (`hasPermission('inventory:product:create')`). Um UUID adicionaria indireção sem ganho. Em contrapartida, `roles` e `memberships` usam UUID porque são registros editáveis com ciclo de vida.

---

## 3. Estratégia Multi-tenant e Isolamento via RLS

### 3.1 Helpers de contexto

```sql
-- Retorna todas as empresas em que o usuário logado tem membership ativo
create or replace function public.user_company_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select company_id from public.memberships
  where user_id = auth.uid() and status = 'active'
$$;

-- Confirma se o usuário é admin global
create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.platform_admins where user_id = auth.uid())
$$;

-- Confirma se o usuário tem uma permissão específica numa empresa
create or replace function public.has_permission(p_company uuid, p_permission text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.memberships m
    join public.membership_roles mr on mr.membership_id = m.id
    join public.role_permissions rp on rp.role_id = mr.role_id
    where m.user_id = auth.uid()
      and m.company_id = p_company
      and m.status = 'active'
      and rp.permission_code = p_permission
  )
$$;
```

### 3.2 Policies RLS (padrão a replicar em toda tabela de tenant)

```sql
alter table public.companies        enable row level security;
alter table public.memberships      enable row level security;
alter table public.roles            enable row level security;
alter table public.role_permissions enable row level security;
alter table public.company_modules  enable row level security;
alter table public.audit_logs       enable row level security;

-- COMPANIES: membro lê sua empresa; platform admin lê todas
create policy "companies_select" on public.companies
  for select using (
    public.is_platform_admin()
    or id in (select public.user_company_ids())
  );

create policy "companies_insert_platform" on public.companies
  for insert with check (public.is_platform_admin());

create policy "companies_update_platform_or_owner" on public.companies
  for update using (
    public.is_platform_admin()
    or exists (
      select 1 from public.memberships
      where user_id = auth.uid() and company_id = companies.id and is_owner
    )
  );

-- MEMBERSHIPS: usuário vê suas memberships e as da mesma empresa
create policy "memberships_select" on public.memberships
  for select using (
    public.is_platform_admin()
    or user_id = auth.uid()
    or company_id in (select public.user_company_ids())
  );

create policy "memberships_insert" on public.memberships
  for insert with check (
    public.is_platform_admin()
    or public.has_permission(company_id, 'core:member:invite')
  );

create policy "memberships_update" on public.memberships
  for update using (
    public.is_platform_admin()
    or public.has_permission(company_id, 'core:member:manage')
  );

-- ROLES e ROLE_PERMISSIONS: leitura para membros da cia; escrita exige permissão
create policy "roles_select" on public.roles
  for select using (company_id in (select public.user_company_ids()));

create policy "roles_write" on public.roles
  for all using (public.has_permission(company_id, 'core:role:manage'))
  with check (public.has_permission(company_id, 'core:role:manage'));

create policy "role_permissions_select" on public.role_permissions
  for select using (
    role_id in (select id from public.roles where company_id in (select public.user_company_ids()))
  );

create policy "role_permissions_write" on public.role_permissions
  for all using (
    exists (
      select 1 from public.roles r
      where r.id = role_permissions.role_id
        and public.has_permission(r.company_id, 'core:role:manage')
    )
  );

-- COMPANY_MODULES: leitura para membros; provisionamento só platform admin
create policy "company_modules_select" on public.company_modules
  for select using (company_id in (select public.user_company_ids()));

create policy "company_modules_write_platform" on public.company_modules
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- AUDIT_LOGS: leitura pelo admin global ou por quem tem permissão na cia; INSERT livre (pelo código)
create policy "audit_logs_select" on public.audit_logs
  for select using (
    public.is_platform_admin()
    or (company_id is not null and public.has_permission(company_id, 'core:audit:read'))
  );
create policy "audit_logs_insert" on public.audit_logs
  for insert with check (true);   -- inserção controlada pelo server (service role)
```

### 3.3 Padrão para tabelas de domínio (ex.: `products`)

```sql
alter table public.products enable row level security;

create policy "products_select" on public.products
  for select using (company_id in (select public.user_company_ids()));

create policy "products_insert" on public.products
  for insert with check (public.has_permission(company_id, 'inventory:product:create'));

create policy "products_update" on public.products
  for update using (public.has_permission(company_id, 'inventory:product:update'));

create policy "products_delete" on public.products
  for delete using (public.has_permission(company_id, 'inventory:product:delete'));
```

> Repita o mesmo _template_ para qualquer tabela nova. **Toda tabela de tenant precisa de `company_id NOT NULL` + RLS** — vire lei do projeto e valide no CI com um script `check-rls.sql`.

---

## 4. Hierarquia de Permissões (RBAC)

### 4.1 Nomenclatura canônica

```
<module>:<resource>:<action>
```

- `module`: código em `modules` (ex: `inventory`, `finance`, `core`)
- `resource`: objeto manipulado (ex: `product`, `movement`, `invoice`)
- `action`: verbo — `read`, `create`, `update`, `delete`, `approve`, `export`

**Regra:** toda permissão é _deny-by-default_. O usuário só pode o que está explicitamente em `role_permissions`.

### 4.2 Seed de permissões centrais (`core`) e de `inventory` / `movements`

```sql
insert into public.modules (code, name, is_system, sort_order) values
  ('core',       'Núcleo',        true,  0),
  ('inventory',  'Estoque',       false, 10),
  ('movements',  'Movimentações', false, 20);

insert into public.permissions (code, module_code, resource, action, description) values
  -- core (gestão da empresa)
  ('core:member:invite',     'core', 'member', 'invite',  'Convidar membro'),
  ('core:member:manage',     'core', 'member', 'manage',  'Gerenciar membros'),
  ('core:role:manage',       'core', 'role',   'manage',  'Gerenciar roles e permissões'),
  ('core:audit:read',        'core', 'audit',  'read',    'Ler logs de auditoria'),
  ('core:company:update',    'core', 'company','update',  'Atualizar dados da empresa'),

  -- inventory
  ('inventory:product:read',   'inventory', 'product', 'read',   'Listar produtos'),
  ('inventory:product:create', 'inventory', 'product', 'create', 'Criar produto'),
  ('inventory:product:update', 'inventory', 'product', 'update', 'Editar produto'),
  ('inventory:product:delete', 'inventory', 'product', 'delete', 'Excluir produto'),
  ('inventory:product:export', 'inventory', 'product', 'export', 'Exportar catálogo'),

  -- movements
  ('movements:movement:read',   'movements', 'movement', 'read',   'Listar movimentações'),
  ('movements:movement:create', 'movements', 'movement', 'create', 'Registrar movimentação'),
  ('movements:movement:cancel', 'movements', 'movement', 'cancel', 'Cancelar movimentação');
```

### 4.3 Roles-padrão criadas no provisionamento

Quando uma empresa é criada, o sistema cria automaticamente três roles (com `is_system = true`, não editáveis):

| Role     | Código     | Descrição                                                 |
| :------- | :--------- | :-------------------------------------------------------- |
| Owner    | `owner`    | Todas as permissões dos módulos habilitados + `core:*`.   |
| Manager  | `manager`  | CRUD em recursos do módulo habilitado, sem `role:manage`. |
| Operator | `operator` | `read` + `create` nos recursos; sem `update`/`delete`.    |

Veja a função `public.bootstrap_company_rbac()` em [§5.2](#52-função-de-bootstrap).

### 4.4 Relação `membership × roles`

Um membro pode acumular várias roles. A permissão efetiva é a **união**:

```sql
select distinct rp.permission_code
from public.memberships m
join public.membership_roles mr on mr.membership_id = m.id
join public.role_permissions rp on rp.role_id       = mr.role_id
where m.user_id = :user_id and m.company_id = :company_id and m.status = 'active';
```

---

## 5. Fluxos de Provisionamento

### 5.1 Criar uma empresa (Global Admin)

1. Admin acessa painel `/admin/companies/new` (rota gated por `is_platform_admin()`).
2. Preenche `name`, `slug`, `plan`, marca módulos a provisionar e informa email do **Owner inicial**.
3. Server Action `createCompanyAction` executa em transação:
   - insere em `companies`
   - insere em `company_modules` (um registro por módulo marcado)
   - chama `bootstrap_company_rbac(company_id)` — cria roles-padrão + seed de `role_permissions`
   - cria/convida o usuário owner (`auth.admin.inviteUserByEmail`) e grava `memberships` + `membership_roles`
   - grava em `audit_logs`: `company.create`

### 5.2 Função de bootstrap

```sql
create or replace function public.bootstrap_company_rbac(p_company uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_owner_role uuid;
  v_manager_role uuid;
  v_operator_role uuid;
  v_module text;
begin
  insert into public.roles (company_id, code, name, is_system)
    values (p_company, 'owner',    'Owner',    true) returning id into v_owner_role;
  insert into public.roles (company_id, code, name, is_system)
    values (p_company, 'manager',  'Gerente',  true) returning id into v_manager_role;
  insert into public.roles (company_id, code, name, is_system)
    values (p_company, 'operator', 'Operador', true) returning id into v_operator_role;

  -- Owner: TUDO dos módulos habilitados + core
  insert into public.role_permissions (role_id, permission_code)
  select v_owner_role, p.code
  from public.permissions p
  where p.module_code = 'core'
     or p.module_code in (select module_code from public.company_modules where company_id = p_company);

  -- Manager: CRUD dos módulos habilitados (sem core:role:manage)
  insert into public.role_permissions (role_id, permission_code)
  select v_manager_role, p.code
  from public.permissions p
  where p.module_code in (select module_code from public.company_modules where company_id = p_company)
     or p.code in ('core:audit:read', 'core:member:invite');

  -- Operator: somente read + create
  insert into public.role_permissions (role_id, permission_code)
  select v_operator_role, p.code
  from public.permissions p
  where p.action in ('read', 'create')
    and p.module_code in (select module_code from public.company_modules where company_id = p_company);
end $$;
```

### 5.3 Convidar membro para uma empresa

Requer `core:member:invite` na empresa alvo.

```ts
// src/modules/tenancy/actions/invite-member.ts
"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/modules/authz";
import { audit } from "@/modules/audit";

const schema = z.object({
  companyId: z.string().uuid(),
  email: z.string().email(),
  roleIds: z.array(z.string().uuid()).min(1),
});

export async function inviteMemberAction(raw: FormData) {
  const input = schema.parse(Object.fromEntries(raw));
  await requirePermission(input.companyId, "core:member:invite");

  const supabase = createClient();
  // 1. Cria/convida o usuário (service role é necessário para convite administrativo)
  const { data: invite, error: invErr } = await supabase.auth.admin.inviteUserByEmail(input.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/accept-invite?c=${input.companyId}`,
  });
  if (invErr) throw invErr;
  const userId = invite.user.id;

  // 2. Cria membership + atribui roles em transação
  const { data: mem, error: memErr } = await supabase
    .from("memberships")
    .insert({ user_id: userId, company_id: input.companyId, status: "invited" })
    .select("id")
    .single();
  if (memErr) throw memErr;

  const rows = input.roleIds.map((role_id) => ({ membership_id: mem.id, role_id }));
  const { error: mrErr } = await supabase.from("membership_roles").insert(rows);
  if (mrErr) throw mrErr;

  await audit({
    companyId: input.companyId,
    action: "member.invite",
    resourceType: "user",
    resourceId: userId,
    metadata: { email: input.email, roleIds: input.roleIds },
  });
}
```

---

## 6. Validação de Permissões no Backend

### 6.1 Camadas de defesa (defense in depth)

1. **Next.js middleware** (`src/middleware.ts`): valida sessão e redireciona anônimos.
2. **Layout server component** (`app/(dashboard)/[companySlug]/layout.tsx`): resolve `companyId` do slug e checa que o usuário é membro.
3. **Guard de módulo**: cada rota `/[companySlug]/inventory/*` valida `company_modules` + permissão de leitura mínima.
4. **Server Action guard**: `requirePermission(companyId, code)` antes de qualquer mutação.
5. **RLS no Postgres**: última linha de defesa — se o código TS falhar, o banco não executa.

### 6.2 Sessão de tenant ativo

Armazene o `companyId` ativo em cookie _httpOnly_ (chave: `erp.active_company`). A troca ocorre via Server Action `switchCompanyAction`. Nunca confie no cookie para autorização — apenas para UX; a autorização se baseia em `memberships`.

### 6.3 Serviço `authz`

```ts
// src/modules/authz/services/authz-service.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";

export class ForbiddenError extends Error {
  constructor(public permission: string) {
    super(`forbidden:${permission}`);
  }
}

/** Retorna o Set de permissões efetivas do usuário logado numa empresa. */
export async function getEffectivePermissions(companyId: string): Promise<Set<string>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select(
      `
      id,
      membership_roles (
        role:roles (
          role_permissions ( permission_code )
        )
      )
    `,
    )
    .eq("company_id", companyId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;
  if (!data) return new Set();

  const perms = new Set<string>();
  for (const mr of data.membership_roles ?? []) {
    for (const rp of mr.role?.role_permissions ?? []) {
      perms.add(rp.permission_code);
    }
  }
  return perms;
}

export async function hasPermission(companyId: string, code: string): Promise<boolean> {
  const perms = await getEffectivePermissions(companyId);
  return perms.has(code);
}

export async function requirePermission(companyId: string, code: string): Promise<void> {
  if (!(await hasPermission(companyId, code))) throw new ForbiddenError(code);
}
```

### 6.4 Higher-order guard para Server Actions

```ts
// src/modules/authz/services/with-permission.ts
import "server-only";
import { requirePermission } from "./authz-service";
import { audit } from "@/modules/audit";

type ActionCtx = { companyId: string; userId: string };

export function withPermission<T>(
  permission: string,
  action: string,
  handler: (ctx: ActionCtx, formData: FormData) => Promise<T>,
) {
  return async function guarded(ctx: ActionCtx, formData: FormData) {
    try {
      await requirePermission(ctx.companyId, permission);
      const result = await handler(ctx, formData);
      await audit({ companyId: ctx.companyId, action, permission, status: "success" });
      return result;
    } catch (e) {
      await audit({
        companyId: ctx.companyId,
        action,
        permission,
        status: e instanceof Error && e.message.startsWith("forbidden:") ? "denied" : "error",
        metadata: { error: (e as Error).message },
      });
      throw e;
    }
  };
}
```

Uso:

```ts
export const createProductAction = withPermission(
  "inventory:product:create",
  "product.create",
  async (ctx, formData) => {
    /* ... */
  },
);
```

### 6.5 Helpers de UI

```tsx
// src/modules/authz/components/can.tsx  (client)
"use client";
import type { ReactNode } from "react";
import { usePermissions } from "../hooks/use-permissions";

export function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { has } = usePermissions();
  return has(permission) ? <>{children}</> : <>{fallback}</>;
}
```

```tsx
<Can permission="inventory:product:create">
  <Button>+ Novo produto</Button>
</Can>
```

> A UI esconde o botão; o **backend é quem realmente nega**. Nunca confie só no front.

---

## 7. Auditoria de Acessos

### 7.1 O que registrar

| Evento                                          | Nível       |
| :---------------------------------------------- | :---------- |
| Autenticação (login, logout, reset)             | obrigatório |
| CRUD em recursos sensíveis                      | obrigatório |
| Acesso negado (permission denied)               | obrigatório |
| Provisionamento (company.create, module.enable) | obrigatório |
| Exportação/download em massa                    | recomendado |
| Read de relatórios financeiros                  | recomendado |

### 7.2 Serviço `audit`

```ts
// src/modules/audit/services/audit-service.ts
import "server-only";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

type AuditEntry = {
  companyId?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  permission?: string;
  status?: "success" | "denied" | "error";
  metadata?: Record<string, unknown>;
};

export async function audit(e: AuditEntry): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const h = headers();

  await supabase.from("audit_logs").insert({
    company_id: e.companyId ?? null,
    actor_user_id: user?.id ?? null,
    actor_email: user?.email ?? null,
    action: e.action,
    resource_type: e.resourceType ?? null,
    resource_id: e.resourceId ?? null,
    permission: e.permission ?? null,
    status: e.status ?? "success",
    ip: (h.get("x-forwarded-for")?.split(",")[0] ?? "").trim() || null,
    user_agent: h.get("user-agent"),
    metadata: e.metadata ?? {},
  });
}
```

### 7.3 Garantias de integridade

- Remova `UPDATE` e `DELETE` da tabela para todos os roles (já feito no DDL).
- Exportação periódica para storage WORM (S3 Object Lock, GCS Bucket Lock) — fora do escopo do MVP, mas planeje.
- Particionamento por mês quando `count > 10M` (`pg_partman`).

---

## 8. Exemplo Prático: Estoque e Movimentações

### 8.1 Migrations dos domínios (com `company_id`)

```sql
-- PRODUCTS (já existentes + tenant_id)
alter table public.products add column company_id uuid not null references public.companies(id);
create index idx_products_company on public.products(company_id);

-- Unicidade do SKU por empresa (não globalmente)
drop index if exists products_sku_key;
alter table public.products drop constraint if exists products_sku_key;
alter table public.products add constraint products_sku_per_company unique (company_id, sku);

-- STOCK_MOVEMENTS
alter table public.stock_movements add column company_id uuid not null references public.companies(id);
create index idx_movements_company on public.stock_movements(company_id);
```

### 8.2 Policies RLS dos domínios

```sql
-- products
alter table public.products enable row level security;

create policy "products_select" on public.products
  for select using (company_id in (select public.user_company_ids()));

create policy "products_insert" on public.products
  for insert with check (public.has_permission(company_id, 'inventory:product:create'));

create policy "products_update" on public.products
  for update using (public.has_permission(company_id, 'inventory:product:update'))
  with check (public.has_permission(company_id, 'inventory:product:update'));

create policy "products_delete" on public.products
  for delete using (public.has_permission(company_id, 'inventory:product:delete'));

-- stock_movements
alter table public.stock_movements enable row level security;

create policy "movements_select" on public.stock_movements
  for select using (company_id in (select public.user_company_ids()));

create policy "movements_insert" on public.stock_movements
  for insert with check (public.has_permission(company_id, 'movements:movement:create'));
```

### 8.3 Server Action com todas as camadas

```ts
// src/modules/inventory/actions/create-product.ts
"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { withPermission } from "@/modules/authz";
import type { ActionResult } from "@/lib/errors";

const schema = z.object({
  sku: z.string().min(1),
  name: z.string().min(2),
  unit: z.enum(["UN", "KG", "L", "CX", "M"]),
  costPrice: z.coerce.number().nonnegative(),
  salePrice: z.coerce.number().nonnegative(),
  minStock: z.coerce.number().nonnegative().default(0),
});

export const createProductAction = withPermission(
  "inventory:product:create",
  "product.create",
  async ({ companyId, userId }, formData): Promise<ActionResult> => {
    const parsed = schema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
    }
    const supabase = createClient();
    const { error } = await supabase.from("products").insert({
      company_id: companyId, // 👈 tenant-scoped
      sku: parsed.data.sku.toUpperCase(),
      name: parsed.data.name,
      unit: parsed.data.unit,
      cost_price: parsed.data.costPrice,
      sale_price: parsed.data.salePrice,
      min_stock: parsed.data.minStock,
      created_by: userId,
    });
    if (error) return { ok: false, message: error.message };

    revalidatePath(`/${companyId}/inventory`);
    return { ok: true, message: "Produto cadastrado" };
  },
);
```

### 8.4 Componente com UI condicional

```tsx
// src/app/(dashboard)/[companySlug]/inventory/page.tsx
import { resolveCompany } from "@/modules/tenancy";
import { listProducts } from "@/modules/inventory";
import { Can } from "@/modules/authz";
import { ProductTable } from "@/modules/inventory/components/product-table";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function InventoryPage({
  params,
  searchParams,
}: {
  params: { companySlug: string };
  searchParams: Record<string, string>;
}) {
  const company = await resolveCompany(params.companySlug);
  const products = await listProducts(company.id, searchParams);

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Estoque — {company.name}</h1>
        <Can permission="inventory:product:create">
          <Button asChild>
            <Link href={`/${company.slug}/inventory/new`}>+ Novo produto</Link>
          </Button>
        </Can>
      </header>
      <ProductTable items={products.data} />
    </section>
  );
}
```

### 8.5 Matriz de permissões (exemplo)

| Permissão                   | Owner | Manager | Operator |
| :-------------------------- | :---: | :-----: | :------: |
| `inventory:product:read`    |  ✅   |   ✅    |    ✅    |
| `inventory:product:create`  |  ✅   |   ✅    |    ✅    |
| `inventory:product:update`  |  ✅   |   ✅    |    ❌    |
| `inventory:product:delete`  |  ✅   |   ✅    |    ❌    |
| `inventory:product:export`  |  ✅   |   ✅    |    ❌    |
| `movements:movement:read`   |  ✅   |   ✅    |    ✅    |
| `movements:movement:create` |  ✅   |   ✅    |    ✅    |
| `movements:movement:cancel` |  ✅   |   ✅    |    ❌    |
| `core:member:invite`        |  ✅   |   ✅    |    ❌    |
| `core:role:manage`          |  ✅   |   ❌    |    ❌    |
| `core:audit:read`           |  ✅   |   ✅    |    ❌    |

---

## 9. Adicionando um Novo Módulo (Financeiro)

Cenário: meses após o MVP, queremos habilitar o módulo `finance` sem refatorar o core.

### 9.1 Passo a passo

**1. Migration do módulo + seed de permissões** (`supabase/migrations/xxxx_finance.sql`):

```sql
insert into public.modules (code, name, sort_order) values ('finance', 'Financeiro', 30);

insert into public.permissions (code, module_code, resource, action, description) values
  ('finance:invoice:read',    'finance', 'invoice', 'read',    'Ler faturas'),
  ('finance:invoice:create',  'finance', 'invoice', 'create',  'Criar fatura'),
  ('finance:invoice:approve', 'finance', 'invoice', 'approve', 'Aprovar fatura'),
  ('finance:payable:read',    'finance', 'payable', 'read',    'Ler contas a pagar'),
  ('finance:payable:create',  'finance', 'payable', 'create',  'Criar conta a pagar');

create table public.invoices (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id),
  number      text not null,
  amount      numeric(14,2) not null,
  status      text not null default 'draft',
  due_date    date,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  unique (company_id, number)
);
create index idx_invoices_company on public.invoices(company_id);

alter table public.invoices enable row level security;
create policy "invoices_select" on public.invoices
  for select using (company_id in (select public.user_company_ids()));
create policy "invoices_insert" on public.invoices
  for insert with check (public.has_permission(company_id, 'finance:invoice:create'));
create policy "invoices_update" on public.invoices
  for update using (public.has_permission(company_id, 'finance:invoice:create'));
```

**2. Código:** criar `src/modules/finance/{actions,queries,components,schemas,services,index.ts}` seguindo o mesmo _blueprint_.

**3. Registro no menu:** adicionar item em `MODULES_MENU` com guard:

```ts
{ label: "Financeiro", href: "/finance", requiresModule: "finance", requiresPermission: "finance:invoice:read" }
```

**4. Ativar na empresa-piloto:** Global Admin marca `finance` em `company_modules`, e roda (uma vez) um SQL para distribuir as permissões nas roles-sistema já existentes:

```sql
-- Owner existente ganha todas; Manager ganha CRUD; Operator ganha read
insert into public.role_permissions (role_id, permission_code)
select r.id, p.code from public.roles r cross join public.permissions p
where r.company_id = :company_id and r.code = 'owner' and p.module_code = 'finance'
on conflict do nothing;
-- ... análogo para manager / operator
```

> **Zero alteração no core.** Nenhum `switch/case` por módulo em lugar nenhum do código. A UI descobre módulos via query em `company_modules × modules`. Permissões são apenas dados.

---

## 10. Convenções, Padrões de Mercado e Checklist

### 10.1 Padrões de mercado adotados

- **UUID v4** em todas as PKs editáveis; identifiers semânticos (`text`) apenas em catálogos declarativos (`modules.code`, `permissions.code`).
- **Naming snake_case** nas tabelas/colunas e **camelCase** nos DTOs TS.
- **Soft delete** via `deleted_at timestamptz` em recursos sensíveis (opt-in por tabela); para catálogos (`modules`, `permissions`) usamos `is_active`.
- **Timestamps** `created_at` / `updated_at` obrigatórios; trigger `set_updated_at` global.
- **Idempotência** de mutações críticas via `Idempotency-Key` (cabeçalho em rotas de API públicas).
- **Rate-limit** por empresa nas APIs públicas (middleware Vercel Edge + Upstash).
- **Convenções de permissão**: sempre `modulo:recurso:acao` em minúsculas.
- **RLS é regra**: nenhuma tabela de tenant sem `company_id` + policies.
- **Auditoria imutável**: `audit_logs` append-only com revoke de UPDATE/DELETE.
- **OAuth/SSO** (pós-MVP): SAML/OIDC por empresa via Supabase Auth ou WorkOS.
- **Backups**: PITR do Supabase + export diário em bucket separado.

### 10.2 Índices recomendados

```sql
-- Leituras frequentes por tenant
create index if not exists idx_products_company_active on public.products(company_id) where is_active;
create index if not exists idx_movements_company_date  on public.stock_movements(company_id, created_at desc);

-- Joins de autorização
create index if not exists idx_memberships_user_company_status
  on public.memberships(user_id, company_id, status);
```

### 10.3 Testes obrigatórios

- **Isolation:** usuário da empresa A **não** consegue `SELECT`/`INSERT` em dados da empresa B (testar direto via supabase-js).
- **Permission deny:** operator **não** consegue `DELETE` produto (espera erro RLS + `ForbiddenError` na action).
- **Cascade:** deletar `companies` remove `memberships`, `roles`, `role_permissions`, `company_modules`.
- **Bootstrap:** criar empresa com módulos `inventory` + `movements` gera três roles com permissões corretas.
- **Audit:** toda ação executada aparece em `audit_logs` com `status` correto.

### 10.4 Checklist de implementação

**Fundação**

- [ ] Migrations 1–10 aplicadas
- [ ] Helpers `user_company_ids`, `is_platform_admin`, `has_permission`
- [ ] Seed de `modules` + `permissions` (core, inventory, movements)
- [ ] Função `bootstrap_company_rbac` testada

**Módulos (`src/modules`)**

- [ ] `tenancy/`: CRUD de `companies`, switcher de empresa ativa, `resolveCompany(slug)`
- [ ] `authz/`: `getEffectivePermissions`, `hasPermission`, `requirePermission`, `withPermission`, componente `<Can>`, hook `usePermissions`
- [ ] `audit/`: serviço `audit()`, queries de listagem para admin

**UI / Roteamento**

- [ ] Rotas `/admin/companies/*` (restritas a platform admin)
- [ ] Rotas `/[companySlug]/...` com layout resolvendo tenant ativo
- [ ] Página de configurações da empresa com aba "Roles & Permissões" (drag & drop)

**Domínios**

- [ ] `products` e `stock_movements` com `company_id + NOT NULL` e RLS por permissão
- [ ] Actions `createProduct` / `registerMovement` usando `withPermission`
- [ ] `<Can>` em todos os botões de ação

**Qualidade**

- [ ] Teste de isolamento entre tenants (automatizado no CI)
- [ ] Script `check-rls.sql` falha o CI se alguma tabela de domínio não tiver RLS habilitado
- [ ] Logs de auditoria ativados em 100% das mutações
- [ ] Documentação por módulo no `index.ts` (JSDoc com permissões necessárias)

---

## 11. Roadmap de Integração com os Módulos Atuais (Auth + Inventory)

> **Premissa:** o MVP descrito em [`PLAN.md`](./PLAN.md) já foi implementado em produção **single-tenant**. O objetivo desta seção é evoluir o sistema para multi-tenant + RBAC sem downtime e sem perder dados, organizando o trabalho em sprints de 1–2 semanas com PRs pequenos e revisáveis.

### 11.1 Estratégia de migração

- **Expand → Migrate → Contract:** adiciona estrutura nova ao lado da antiga, migra dados, só depois remove o legado.
- **Feature flag `MULTITENANCY_ENABLED`** (env var) controla quando o `companyId` passa a ser obrigatório no código.
- **Default Company:** todo dado existente é migrado para uma empresa única `default-company`, preservando o histórico.
- **Nenhum `DROP` antes do sprint de _contract_**. Sempre `ALTER ... NULL → NOT NULL` depois do backfill.
- **Cada sprint fecha com:** `db:push` + `db:types` + testes verdes + deploy preview na Vercel.

### 11.2 Visão geral dos sprints

| Sprint | Foco                                                              |  Duração  | Dependências |
| :----: | :---------------------------------------------------------------- | :-------: | :----------- |
| **S0** | Preparação e guard-rails                                          |  2 dias   | —            |
| **S1** | Fundação multi-tenant (DB + helpers)                              | 1 semana  | S0           |
| **S2** | Módulo `tenancy` + switcher de empresa                            | 1 semana  | S1           |
| **S3** | Módulo `authz` + `audit`                                          | 1 semana  | S2           |
| **S4** | Refactor do módulo `auth` (profiles → memberships)                | 1 semana  | S3           |
| **S5** | Refactor do módulo `inventory` (company_id + RLS por permissão)   | 2 semanas | S3           |
| **S6** | Painel `/admin` do Platform Admin                                 | 1 semana  | S2           |
| **S7** | UI de gestão de membros & roles por empresa                       | 1 semana  | S5           |
| **S8** | Sprint de _contract_ (remoção do legado)                          |  3 dias   | S4, S5       |
| **S9** | Hardening: testes de isolamento, RLS guard no CI, observabilidade | 1 semana  | S8           |

---

### 11.3 Sprint 0 — Preparação

**Objetivo:** criar guard-rails antes de mexer em qualquer esquema.

**PRs**

- **PR #01** — `chore(ci): baseline de rollback`
  - Dump do schema atual em `supabase/snapshots/pre-multitenant.sql`.
  - Tag git `pre-multitenant` para rollback rápido.
- **PR #02** — `feat(config): flag MULTITENANCY_ENABLED`
  - Adicionar a variável em `src/core/config/env.ts` (Zod, default `false`).
  - Criar helper `src/core/config/flags.ts` → `isMultitenancyEnabled()`.
- **PR #03** — `test(infra): script check-rls.sql no CI`
  - Script SQL que lista tabelas do schema `public` sem `rowsecurity = true` ou sem policies. Falha CI se houver.

**Critérios de aceite**

- `npm run test:rls` passa localmente e no CI.
- Flag disponível em todos os ambientes com valor explícito.

---

### 11.4 Sprint 1 — Fundação Multi-Tenant

**Objetivo:** aplicar o modelo de dados de §2 sem tocar nas tabelas de domínio ainda.

**PRs**

- **PR #04** — `db: migration 01_tenancy_core.sql`
  - Cria `companies`, `platform_admins`, `modules`, `permissions`, `company_modules`, `roles`, `role_permissions`, `memberships`, `membership_roles`, `audit_logs`.
  - Todas com RLS **habilitado** mas sem policies ainda (lock by default).
- **PR #05** — `db: migration 02_helpers_and_policies.sql`
  - Funções `user_company_ids()`, `is_platform_admin()`, `has_permission(company, perm)`, `bootstrap_company_rbac(company)`.
  - Policies RLS das tabelas da fundação (conforme §3.2).
- **PR #06** — `db: seed 03_seed_core_permissions.sql`
  - Seeds de `modules` (`core`, `inventory`, `movements`) e `permissions` (ver §4.2).
- **PR #07** — `db: migration 04_default_company.sql`
  - Cria empresa semente `default-company` (slug fixo) com todos os módulos habilitados.
  - Chama `bootstrap_company_rbac()` para gerar roles `owner/manager/operator`.
- **PR #08** — `chore(types): regen database.types.ts`
  - `npm run db:types` e commit. Nenhum código TS consome ainda.

**Critérios de aceite**

- `npm run db:push` aplica limpo em ambiente vazio.
- Admin interno consegue logar no Supabase Studio e ver as tabelas novas.
- Tabelas da fundação têm RLS ativo (script `check-rls.sql` passa).

---

### 11.5 Sprint 2 — Módulo `tenancy` + switcher

**Objetivo:** criar o módulo `src/modules/tenancy` e o conceito de **empresa ativa**, sem ainda exigir `companyId` nas actions existentes.

**Arquivos criados**

```
src/modules/tenancy/
├── actions/
│   ├── create-company.ts          # platform admin
│   ├── update-company.ts
│   └── switch-active-company.ts   # seta cookie httpOnly
├── queries/
│   ├── list-my-companies.ts
│   ├── resolve-company.ts         # por slug → Company
│   └── list-all-companies.ts      # platform admin only
├── schemas/index.ts
├── services/
│   ├── active-company.ts          # getActiveCompanyId() via cookie + fallback
│   └── company-service.ts
├── components/
│   ├── company-switcher.tsx       # dropdown no header
│   └── company-badge.tsx
└── index.ts
```

**PRs**

- **PR #09** — `feat(tenancy): módulo tenancy + cookie de empresa ativa`
  - Cookie `erp.active_company` httpOnly, SameSite=Lax.
  - `getActiveCompanyId()` lê cookie, valida membership, faz fallback para a primeira empresa ativa do usuário.
- **PR #10** — `feat(tenancy): CompanySwitcher no header`
  - Componente Shadcn `<DropdownMenu>` listando `list-my-companies`.
  - Mostra badge da empresa ativa ao lado do nome do usuário.
- **PR #11** — `feat(tenancy): rota /admin/companies/*` (gated por `is_platform_admin`)
  - Listagem, criação e edição de empresas.
  - Criação dispara `bootstrap_company_rbac` + envia convite ao Owner.

**Critérios de aceite**

- Usuário com 2+ memberships consegue alternar entre empresas e ver o cookie mudando.
- Platform admin cria uma nova empresa e recebe a confirmação no audit log.

---

### 11.6 Sprint 3 — Módulos `authz` + `audit`

**Objetivo:** construir os serviços horizontais que os domínios consumirão a partir do Sprint 4.

**Arquivos criados**

```
src/modules/authz/
├── services/
│   ├── authz-service.ts     # getEffectivePermissions, hasPermission, requirePermission
│   └── with-permission.ts   # HOC para Server Actions (§6.4)
├── hooks/
│   └── use-permissions.ts   # client — lê do RSC via context provider
├── components/
│   ├── can.tsx              # <Can permission="...">
│   └── permissions-provider.tsx
└── index.ts

src/modules/audit/
├── actions/
│   └── (vazio por enquanto — consumidores chamam via service)
├── queries/
│   └── list-audit-logs.ts
├── services/
│   └── audit-service.ts     # audit({...})
├── components/
│   └── audit-log-table.tsx
└── index.ts
```

**PRs**

- **PR #12** — `feat(authz): authz-service + withPermission + Can`
  - `requirePermission(companyId, code)` lança `ForbiddenError`.
  - `<Can permission="inventory:product:create">` via `PermissionsProvider` injetado no layout do tenant.
- **PR #13** — `feat(audit): audit-service + tabela + página /audit`
  - `audit({...})` insere em `audit_logs`.
  - Página `/[companySlug]/audit` lista logs (gated por `core:audit:read`).
- **PR #14** — `test(authz): testes unitários do authz-service`
  - Mocks do Supabase client; verifica união de permissões de múltiplas roles.

**Critérios de aceite**

- Owner vê todos os botões; Operator **não** vê botões de delete (via `<Can>`).
- `requirePermission` bloqueia com `ForbiddenError` em tentativas diretas.
- Audit log registra uma entrada `product.create` após criar um produto pelo MVP atual.

---

### 11.7 Sprint 4 — Refactor do módulo `auth`

**Objetivo:** evoluir o `auth` atual para trabalhar com `memberships`, sem quebrar login existente.

**Mudanças**

- `profiles.role` (enum antigo) **deprecated** — continua lá mas não é mais lida. Nova verdade vem de `memberships + membership_roles`.
- `getCurrentUser()` passa a retornar `{ user, memberships: CompanyMembership[] }`.
- Login não muda; após autenticar, redireciona para `/[companySlug]` da empresa ativa.
- Fluxo de cadastro novo → cria usuário → adiciona `membership` na `default-company` como `operator` (comportamento configurável via flag).

**PRs**

- **PR #15** — `refactor(auth): getCurrentUser retorna memberships`
  - Atualiza consumidores (dashboard layout, middleware, menu).
  - Mantém `profiles.role` intocado para rollback.
- **PR #16** — `feat(auth): accept-invite flow`
  - Rota `/accept-invite?c=<companyId>&token=...`.
  - Troca `membership.status` de `invited` → `active`.
  - Redireciona para `/[companySlug]`.
- **PR #17** — `refactor(auth): onboarding cria membership default`
  - Trigger `on_auth_user_created` passa a criar também membership em `default-company` enquanto flag `MULTITENANCY_ENABLED = false`.
  - Quando flag ligar, comportamento muda para exigir convite.
- **PR #18** — `chore(auth): mover logic de roles para authz`
  - Remove `canWriteProducts`, `isAdmin` (legados) e substitui por `hasPermission`.

**Critérios de aceite**

- Login de usuários antigos continua funcionando e os carrega na `default-company`.
- Novo fluxo de convite cria membership em estado `invited` que vira `active` no aceite.

---

### 11.8 Sprint 5 — Refactor do módulo `inventory`

**Objetivo:** aplicar `company_id` + RLS por permissão em `products` e `stock_movements` **com backfill de dados** e **zero-downtime**.

> Esse é o sprint mais crítico. Cada subfase é um PR separado.

**Subfase A — Adicionar `company_id` NULLABLE + backfill**

- **PR #19** — `db: migration 05_products_company_nullable.sql`
  ```sql
  alter table public.products add column company_id uuid references public.companies(id);
  alter table public.stock_movements add column company_id uuid references public.companies(id);
  create index on public.products(company_id);
  create index on public.stock_movements(company_id);
  ```
- **PR #20** — `db: migration 06_backfill_default_company.sql`

  ```sql
  update public.products
     set company_id = (select id from public.companies where slug = 'default-company')
   where company_id is null;

  update public.stock_movements
     set company_id = (select id from public.companies where slug = 'default-company')
   where company_id is null;
  ```

- **PR #21** — `chore(types): regen types` (após backfill).

**Subfase B — Código passa a gravar `company_id`**

- **PR #22** — `refactor(inventory): actions preenchem company_id`
  - `createProduct`, `registerMovement` leem `getActiveCompanyId()` e inserem.
  - `listProducts(companyId, ...)` passa a receber `companyId` explicitamente.
  - Pages `/inventory/*` migradas para `/[companySlug]/inventory/*`.
- **PR #23** — `refactor(inventory): SKU único por empresa`
  ```sql
  alter table public.products drop constraint products_sku_key;
  alter table public.products add constraint products_sku_per_company unique (company_id, sku);
  ```

**Subfase C — Tornar `company_id` obrigatório**

- **PR #24** — `db: migration 07_products_company_not_null.sql`
  ```sql
  alter table public.products alter column company_id set not null;
  alter table public.stock_movements alter column company_id set not null;
  ```

**Subfase D — Ativar RLS por permissão**

- **PR #25** — `db: migration 08_products_rls.sql` (policies de §8.2).
- **PR #26** — `db: migration 09_movements_rls.sql`.
- **PR #27** — `refactor(inventory): actions envolvidas em withPermission`
  - `createProduct` → `withPermission("inventory:product:create", "product.create", ...)`.
  - `updateProduct` → `inventory:product:update`.
  - `deleteProduct` → `inventory:product:delete`.
  - `registerMovement` → `movements:movement:create`.
  - `cancelMovement` → `movements:movement:cancel`.
- **PR #28** — `feat(inventory): UI usa <Can>`
  - Esconde botões "+ Novo produto", "Editar", "Excluir", "Registrar movimento" quando usuário não tem permissão.
  - Badge de "Apenas leitura" quando é Operator sem `create`.

**Subfase E — Testes de isolamento**

- **PR #29** — `test(inventory): isolation suite`
  - Cria 2 empresas + 2 usuários (um em cada).
  - Garante que `user_a` **não** vê produtos de `company_b`.
  - Garante que `operator` **não** consegue `DELETE`.

**Critérios de aceite**

- `company_id` NOT NULL em ambas as tabelas.
- RLS ativo, policies por permissão.
- Operador **não** consegue excluir produto nem pela UI nem por chamada direta.
- Testes de isolamento no CI.

---

### 11.9 Sprint 6 — Painel do Platform Admin

**Objetivo:** UI para o time interno do SaaS gerenciar as empresas.

**Rotas**

```
/admin
├── /companies                 # lista todas (gated is_platform_admin)
├── /companies/new             # wizard: dados → módulos → owner inicial
├── /companies/[id]            # overview + métricas
├── /companies/[id]/modules    # habilitar/desabilitar módulos
├── /companies/[id]/members    # visão consolidada
└── /audit                     # logs globais de plataforma
```

**PRs**

- **PR #30** — `feat(admin): lista e criação de empresas` (wizard 3 passos).
- **PR #31** — `feat(admin): toggle de módulos por empresa` (checkbox grid).
- **PR #32** — `feat(admin): audit global + filtros por empresa/ação/ator`.

**Critérios de aceite**

- Admin cria empresa, marca módulos, recebe link de convite do Owner.
- Toggle de módulo atualiza `company_modules` e redistribui permissões novas nas roles-sistema.

---

### 11.10 Sprint 7 — Gestão de membros e roles (por empresa)

**Objetivo:** permitir que Owner/Manager de uma empresa gerenciem sua equipe.

**Rotas**

```
/[companySlug]/settings/
├── general                  # core:company:update
├── members                  # core:member:manage
│   ├── invite               # dialog
│   └── [memberId]           # editar roles
└── roles                    # core:role:manage
    ├── new
    └── [roleId]             # matriz de permissões (checkboxes por módulo)
```

**PRs**

- **PR #33** — `feat(settings): listagem/convite/remoção de membros`.
- **PR #34** — `feat(settings): CRUD de roles customizadas` (não editáveis: `owner`, `manager`, `operator` — `is_system=true`).
- **PR #35** — `feat(settings): matriz de permissões` (agrupada por módulo habilitado, usa `company_modules`).

**Critérios de aceite**

- Manager convida um Operator por email; Operator aceita e acessa somente recursos permitidos.
- Editar uma role reflete imediatamente nas permissões efetivas (usa `revalidatePath`).

---

### 11.11 Sprint 8 — Sprint de _Contract_ (remover legado)

**Objetivo:** remover os restos do modelo single-tenant.

**PRs**

- **PR #36** — `refactor(auth): remover profiles.role e helpers legados`
  - `ALTER TABLE profiles DROP COLUMN role;`
  - Deletar `canWriteProducts`, `isAdmin` que ainda existirem.
- **PR #37** — `chore(flags): remover MULTITENANCY_ENABLED`
  - Código assume multi-tenant universalmente.
  - Middleware passa a exigir `companySlug` na URL em todas as rotas de `(dashboard)`.
- **PR #38** — `chore(routes): remover rotas legadas /inventory/*` (sem slug).
  - Middleware redireciona para `/[defaultSlug]/inventory/*` por 30 dias, depois 410.

**Critérios de aceite**

- Sem referência a `profiles.role` no código ou SQL.
- Flag removida do `env.ts`.
- Cobertura de testes ≥ 80% nos módulos `tenancy`, `authz`, `inventory`.

---

### 11.12 Sprint 9 — Hardening

**Objetivo:** deixar o sistema pronto para onboarding real de clientes.

**PRs**

- **PR #39** — `test(rls): suite de isolamento cross-tenant`
  - Para cada tabela de domínio: cria 2 cias, insere em cada, tenta `SELECT` como user da outra — deve retornar 0 linhas.
- **PR #40** — `chore(ci): check-rls.sql obrigatório no pipeline`
  - Falha o CI se alguma tabela nova em `public` não tiver RLS.
- **PR #41** — `feat(observability): headers `x-request-id` + correlação com audit_logs`
  - Middleware injeta UUID por request e grava em `audit_logs.metadata.request_id`.
- **PR #42** — `docs: playbook de onboarding de cliente`
  - Passo-a-passo que o time usa para provisionar uma empresa nova.

**Critérios de aceite**

- Teste de isolamento roda em < 30s no CI.
- Qualquer PR que adicione tabela sem RLS é **bloqueado**.
- Time consegue provisionar uma empresa nova em < 5 min seguindo o playbook.

---

### 11.13 Mapa de impacto nos arquivos atuais

| Arquivo atual                                        | Mudança                                                     |   Sprint    |
| :--------------------------------------------------- | :---------------------------------------------------------- | :---------: |
| `src/modules/auth/queries/get-current-user.ts`       | Retornar também `memberships`                               |     S4      |
| `src/modules/auth/services/profile-service.ts`       | Remover `canWriteProducts`/`isAdmin`                        |    S4→S8    |
| `src/modules/auth/actions/sign-up.ts`                | Criar `membership` na `default-company`                     |     S4      |
| `src/middleware.ts`                                  | Parse do `companySlug` da URL                               |     S2      |
| `src/app/(dashboard)/layout.tsx`                     | Mover para `/[companySlug]/` + `PermissionsProvider`        |     S3      |
| `src/app/(dashboard)/inventory/**`                   | Mover para `src/app/(dashboard)/[companySlug]/inventory/**` |     S5      |
| `src/modules/inventory/actions/create-product.ts`    | Wrapper `withPermission` + `company_id`                     |     S5      |
| `src/modules/inventory/actions/register-movement.ts` | Wrapper `withPermission` + `company_id`                     |     S5      |
| `src/modules/inventory/queries/list-products.ts`     | Receber `companyId` explicitamente                          |     S5      |
| `src/modules/inventory/components/product-table.tsx` | `<Can>` nos botões                                          |     S5      |
| `src/core/navigation/menu.ts`                        | Itens com `requiresModule` e `requiresPermission`           |     S2      |
| `supabase/migrations/`                               | +10 migrations novas (numeradas a partir da atual)          |   S1, S5    |
| `src/types/database.types.ts`                        | Regen após cada sprint de migration                         | S1/S4/S5/S8 |

### 11.14 Ordem de execução compacta (checklist mestre)

- [x] S0 · #01–#03 · guard-rails + flag — **mergeado (PR #1)**
- [x] S1 · #04–#08 · fundação DB + seeds + default-company — **mergeado (PR #1)**
- [x] S2 · #09–#11 · módulo `tenancy` + switcher + `/admin/companies` — **mergeado (PR #2)**
- [x] S3 · #12–#14 · `authz` + `audit` + `<Can>` — **mergeado (PR #3)**
- [x] S4 · #15–#18 · refactor `auth` (memberships) — **mergeado (PR #4)**
- [x] S5 · #19–#29 · refactor `inventory` (company_id → RLS → withPermission → tests) — **mergeado (PR #5)**
- [x] S6 · #30–#32 · painel platform admin — **mergeado (direto em main)**
- [x] S7 · #33–#35 · gestão de membros/roles por empresa — **mergeado (PR #6)**
- [x] S8 · #36–#38 · _contract_ — remover legado — **mergeado (PR #7)**
- [x] S9 · #39–#42 · hardening — RLS check, isolation tests, observabilidade — **mergeado (PR #16)**

### 11.15 Riscos e mitigações

| Risco                                                                         | Mitigação                                                                                                                       |
| :---------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------ |
| Backfill da `default-company` erra 1 produto → linha "órfã"                   | `company_id NOT NULL` só vem no PR #24; até lá, job de verificação `SELECT count(*) WHERE company_id IS NULL` bloqueia o merge. |
| Policy RLS muito restritiva quebra telas antigas                              | Feature flag `MULTITENANCY_ENABLED` mantém policy permissiva para `default-company` até S8.                                     |
| Usuário antigo sem `membership` após deploy do S4                             | Migration `04_default_company.sql` também faz `INSERT` de `memberships` para todo `auth.users` existente.                       |
| Permissões das roles-sistema dessincronizadas quando novo módulo é habilitado | Trigger `on_company_modules_insert` chama rotina que re-seed das permissões nas roles `is_system=true`.                         |
| Regressão na UI (botões sumindo indevidamente)                                | Teste e2e (Playwright) com 3 personas (Owner/Manager/Operator) fixas por ambiente.                                              |

---

## 12. Estratégia de Testes (obrigatória em toda feature)

> **Política do projeto:** toda feature entra em produção com testes automatizados. Nenhum PR passa sem: (a) testes novos cobrindo o comportamento adicionado; (b) todos os testes da suíte verdes no CI; (c) gates de cobertura mínimos atingidos. Features sem testes são **bloqueadas no review**.

### 12.1 Pirâmide de testes

```
                 ╱──────────────╲
                ╱   E2E (lento)  ╲          5–10 cenários críticos (Playwright)
               ╱──────────────────╲         login, convite, CRUD com permissão, isolamento
              ╱                    ╲
             ╱  Integration (médio) ╲       Server Actions + RLS contra Supabase local
            ╱────────────────────────╲      ~40% dos testes; usa @supabase local
           ╱                          ╲
          ╱     Unit (rápido)          ╲    services/, schemas/, helpers/
         ╱──────────────────────────────╲   ~50% dos testes; mocks leves (Vitest)
```

### 12.2 Ferramentas

| Camada                     | Ferramenta                                                       | Quando usar                                                                 |
| :------------------------- | :--------------------------------------------------------------- | :-------------------------------------------------------------------------- |
| Unit                       | **Vitest**                                                       | Funções puras em `services/`, parsing de Zod, formatters, regras de RBAC.   |
| Component                  | **@testing-library/react** + Vitest                              | Componentes `<Can>`, formulários, tabelas (render + interação).             |
| Integration (SQL)          | **pgTAP** ou SQL assertions em `supabase/tests/`                 | Triggers (`apply_stock_movement`), helpers (`has_permission`), cascades.    |
| Integration (Action + RLS) | Vitest + **@supabase/supabase-js** contra `supabase start` local | Server Actions de ponta a ponta, com usuários reais e RLS ativo.            |
| E2E                        | **Playwright**                                                   | Fluxos completos no navegador: login → criar produto → registrar movimento. |
| Contrato Zod               | **zod-to-jsonschema** + snapshot                                 | Garante que alterações em schemas sejam intencionais.                       |

### 12.3 Convenções

- Nomear arquivos: `*.test.ts` (unit/integration) e `*.e2e.ts` (Playwright).
- Um arquivo de teste **por arquivo produzido** quando fizer sentido (ex: `stock-service.ts` → `stock-service.test.ts`).
- **AAA pattern** (Arrange · Act · Assert) em todos os cases.
- **Sem mocks globais** — preferir injeção de dependência e _fakes_ tipados.
- Teste é documentação: nomes descritivos em português (`deve recusar saída quando estoque é insuficiente`).
- `beforeEach` reseta o DB local via `supabase db reset --no-seed` + factory de seed controlado.
- **Flakiness zero:** teste `flaky` = teste quebrado. Sem retries automáticos em CI.

### 12.4 Scripts e estrutura

**`package.json`**

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:unit": "vitest run --project unit",
    "test:int": "vitest run --project integration",
    "test:e2e": "playwright test",
    "test:rls": "supabase test db",
    "test:coverage": "vitest run --coverage",
    "test:ci": "npm run test:unit && npm run test:int && npm run test:rls && npm run test:e2e"
  }
}
```

**Layout dos testes**

```
src/modules/<dominio>/
├── services/
│   ├── stock-service.ts
│   └── stock-service.test.ts            # unit
├── actions/
│   ├── create-product.ts
│   └── create-product.test.ts           # integration (supabase local)
└── components/
    ├── product-form.tsx
    └── product-form.test.tsx            # component

supabase/tests/
├── 01_helpers.test.sql                  # pgTAP: has_permission, user_company_ids
├── 02_triggers.test.sql                 # pgTAP: apply_stock_movement, handle_new_user
└── 03_rls_isolation.test.sql            # pgTAP: cross-tenant deny

tests/e2e/
├── fixtures/
│   ├── personas.ts                      # owner, manager, operator
│   └── seed.ts
├── auth.e2e.ts
├── inventory.e2e.ts
└── multitenant-isolation.e2e.ts
```

### 12.5 Padrões por tipo de teste

**Unit (Vitest) — `services/stock-service.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { validateMovement, InsufficientStockError } from "./stock-service";

describe("validateMovement", () => {
  it("aceita entrada com qualquer quantidade positiva", () => {
    expect(() => validateMovement({ productId: "x", type: "in", quantity: 10 }, 0)).not.toThrow();
  });

  it("recusa saída maior que o estoque atual", () => {
    expect(() => validateMovement({ productId: "x", type: "out", quantity: 5 }, 3)).toThrow(
      InsufficientStockError,
    );
  });
});
```

**Integration (Server Action + RLS real) — `actions/create-product.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { createTestUser, createTestCompany, signInAs, resetDb } from "@/tests/helpers";
import { createProductAction } from "./create-product";

describe("createProductAction", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("Manager cria produto com sucesso", async () => {
    const { company } = await createTestCompany({ slug: "acme" });
    const manager = await createTestUser({ role: "manager", company });
    const client = await signInAs(manager);

    const fd = new FormData();
    fd.set("sku", "SKU-001");
    fd.set("name", "Caneta");
    fd.set("unit", "UN");
    fd.set("costPrice", "1");
    fd.set("salePrice", "2");

    const result = await createProductAction({ companyId: company.id, userId: manager.id }, fd);

    expect(result.ok).toBe(true);
    const { data } = await client.from("products").select("*").eq("sku", "SKU-001").single();
    expect(data?.company_id).toBe(company.id);
  });

  it("Operator é bloqueado pela RLS ao tentar criar", async () => {
    const { company } = await createTestCompany();
    const operator = await createTestUser({ role: "operator", company });
    const fd = new FormData();
    fd.set("sku", "SKU-002");
    fd.set("name", "Lápis");
    fd.set("unit", "UN");
    fd.set("costPrice", "1");
    fd.set("salePrice", "2");

    const result = await createProductAction({ companyId: company.id, userId: operator.id }, fd);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/forbidden|permission/i);
  });
});
```

**RLS isolation (pgTAP) — `supabase/tests/03_rls_isolation.test.sql`**

```sql
begin;
select plan(3);

-- Fixtures: duas empresas, um usuário em cada
select tests.create_company('acme');
select tests.create_company('globex');
select tests.create_user_in('u_acme@test', 'acme', 'operator');
select tests.create_user_in('u_globex@test', 'globex', 'operator');

-- Produto em cada empresa
set local role service_role;
insert into products (id, company_id, sku, name, unit, cost_price, sale_price)
values (gen_random_uuid(), tests.company_id('acme'),   'A-1', 'A', 'UN', 1, 2),
       (gen_random_uuid(), tests.company_id('globex'), 'G-1', 'G', 'UN', 1, 2);

-- Usuário de ACME NÃO deve ver nada de Globex
select tests.authenticate_as('u_acme@test');
select is(
  (select count(*)::int from products where sku = 'G-1'),
  0,
  'operador ACME não vê produtos de Globex'
);

-- Operator NÃO pode deletar
select throws_like(
  $$ delete from products where sku = 'A-1' $$,
  '%new row violates row-level security%',
  'operator não consegue delete'
);

-- Manager pode deletar
select tests.authenticate_as_role('u_acme@test', 'manager');
select lives_ok(
  $$ delete from products where sku = 'A-1' $$,
  'manager consegue delete'
);

select * from finish();
rollback;
```

**Component (Testing Library) — `product-form.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductForm } from "./product-form";

vi.mock("../actions/create-product", () => ({
  createProductAction: vi.fn().mockResolvedValue({ ok: true, message: "Produto cadastrado" }),
}));

describe("<ProductForm>", () => {
  it("exibe erros de validação quando SKU está vazio", async () => {
    render(<ProductForm />);
    await userEvent.click(screen.getByRole("button", { name: /salvar/i }));
    expect(await screen.findByText(/obrigatório|required/i)).toBeInTheDocument();
  });
});
```

**E2E (Playwright) — `tests/e2e/inventory.e2e.ts`**

```ts
import { test, expect } from "@playwright/test";
import { loginAs, seedCompany } from "./fixtures";

test.describe("Inventory — Manager", () => {
  test.beforeEach(async ({ page }) => {
    await seedCompany("acme");
    await loginAs(page, "manager@acme.test");
  });

  test("cria produto e registra entrada de estoque", async ({ page }) => {
    await page.goto("/acme/inventory/new");
    await page.fill('[name="sku"]', "E2E-001");
    await page.fill('[name="name"]', "Produto E2E");
    await page.selectOption('[name="unit"]', "UN");
    await page.fill('[name="costPrice"]', "10");
    await page.fill('[name="salePrice"]', "20");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/acme\/inventory$/);
    await expect(page.getByText("E2E-001")).toBeVisible();
  });
});

test.describe("Inventory — Operator (acesso negado)", () => {
  test("não vê botão '+ Novo produto'", async ({ page }) => {
    await loginAs(page, "operator@acme.test");
    await page.goto("/acme/inventory");
    await expect(page.getByRole("link", { name: /novo produto/i })).toHaveCount(0);
  });
});
```

### 12.6 Matriz mínima de testes por feature

Para cada Server Action/recurso novo, é **obrigatório** cobrir:

| Cenário                                                           | Tipo                 | Severidade     |
| :---------------------------------------------------------------- | :------------------- | :------------- |
| Input válido → sucesso                                            | integration          | 🔴 obrigatório |
| Input inválido → `fieldErrors` do Zod                             | unit ou integration  | 🔴 obrigatório |
| Usuário sem permissão → negado (`ForbiddenError`)                 | integration          | 🔴 obrigatório |
| Usuário de outra empresa não consegue ler/escrever → RLS bloqueia | integration ou pgTAP | 🔴 obrigatório |
| Regra de negócio específica (ex: estoque negativo)                | unit no service      | 🔴 obrigatório |
| Audit log criado com `status` correto                             | integration          | 🟡 recomendado |
| Revalidação de cache aciona                                       | integration          | 🟢 opcional    |

### 12.7 Gates de cobertura no CI

| Métrica                               |          Mínimo          | Falha o build? |
| :------------------------------------ | :----------------------: | :------------: |
| Cobertura total (`vitest --coverage`) |      **80%** linhas      |       ✅       |
| Cobertura em `modules/**/services/**` |         **95%**          |       ✅       |
| Cobertura em `modules/**/actions/**`  |         **85%**          |       ✅       |
| `supabase test db` (pgTAP)            | 100% dos arquivos passam |       ✅       |
| `playwright test` — cenários críticos |       100% passam        |       ✅       |
| Lint + typecheck                      |        sem erros         |       ✅       |

**GitHub Actions (trecho)**

```yaml
- name: Start Supabase
  run: supabase start
- name: Unit + Integration
  run: npm run test:unit && npm run test:int
- name: RLS (pgTAP)
  run: npm run test:rls
- name: E2E
  run: npx playwright install --with-deps && npm run test:e2e
- name: Coverage gate
  run: npm run test:coverage -- --reporter=json-summary
- name: Upload coverage
  uses: actions/upload-artifact@v4
```

### 12.8 Test PRs inseridos em cada sprint

> Nenhum sprint é considerado "concluído" sem seu PR de testes. Abaixo a adição canônica a cada sprint (já referenciada em §11):

| Sprint | PR de testes                                                    | Escopo                                                                  |
| :----: | :-------------------------------------------------------------- | :---------------------------------------------------------------------- |
|   S0   | #03                                                             | Script `check-rls.sql` no CI                                            |
|   S1   | **#08.5 — test(db): pgTAP para helpers e bootstrap**            | `has_permission`, `user_company_ids`, `bootstrap_company_rbac` cobertos |
|   S2   | **#11.5 — test(tenancy): switcher + resolve-company**           | Cookie honrado; fallback; rota `/admin` bloqueia não-admin              |
|   S3   | **#14 (já previsto) + #14.5 — test(audit)**                     | Une com `authz`; cobre registro e consulta com RLS                      |
|   S4   | **#18.5 — test(auth): fluxo convite → aceite**                  | Estados de `membership.status`, login após aceite                       |
|   S5   | **#29 (já previsto) + component tests**                         | Isolamento cross-tenant + `<Can>` esconde botões corretamente           |
|   S6   | **#32.5 — test(admin): criação de empresa e toggle de módulos** | Bootstrap roles + reseed de permissões                                  |
|   S7   | **#35.5 — test(settings): CRUD de roles + matriz**              | Role customizada aplicada em tempo real                                 |
|   S8   | **#38.5 — test(regression): suite full rodando sem a flag**     | Todo fluxo passa sem `MULTITENANCY_ENABLED`                             |
|   S9   | **#39–#40 (já previstos)**                                      | Isolation suite + RLS gate obrigatório                                  |

### 12.9 Test helpers reutilizáveis

Criar em `src/tests/helpers/` funções que todo teste de integração consome:

```ts
// src/tests/helpers/factories.ts
export async function createTestCompany(opts?: Partial<{ slug: string; modules: string[] }>) {
  const slug = opts?.slug ?? `test-${crypto.randomUUID().slice(0, 8)}`;
  // ... cria em companies, habilita módulos, chama bootstrap_company_rbac
}

export async function createTestUser(opts: {
  role: "owner" | "manager" | "operator";
  company: Company;
}) {
  // ... cria em auth.users, cria membership, associa role de sistema
}

export async function signInAs(user: TestUser): Promise<SupabaseClient> {
  // ... retorna client autenticado via auth.signInWithPassword
}

export async function resetDb() {
  // ... supabase db reset + aplica seeds mínimos + snapshot para speed
}
```

> **Princípio:** um teste não deve saber nada sobre SQL interno. Todo setup vem do _factory_. Isso evita vazamento de detalhes e facilita refactor.

### 12.10 Definition of Done (checklist de review)

Em cada PR, o revisor confere:

- [ ] PR inclui testes cobrindo o comportamento novo/alterado
- [ ] Nome dos testes descreve o comportamento em português
- [ ] Cenário de "acesso negado" testado (quando a feature é gated por permissão)
- [ ] Cenário de isolamento multi-tenant testado (quando toca tabela com `company_id`)
- [ ] Cobertura local não caiu abaixo do gate
- [ ] E2E do fluxo tocado ainda passa
- [ ] Testes rodam em < 2 min em dev local

---

> **Resumo executivo:** Empresas são tenants isolados por `company_id` + RLS; módulos e permissões são **dados declarativos** (não código) registrados em tabelas; usuários entram em empresas via `memberships` e acumulam `roles`; o backend valida cinco camadas (middleware → layout → guard de módulo → `withPermission` → RLS); novos módulos são acrescentados inserindo linhas em `modules` + `permissions` e aplicando o mesmo _template_ de RLS — **zero refatoração do core**. A integração ao MVP atual acontece em **10 sprints** (S0–S9) e **42 PRs** pequenos, usando a estratégia _Expand → Migrate → Contract_ com flag de feature e `default-company` para garantir zero-downtime. **Toda feature é entregue com testes automatizados** cobrindo unit/integration/e2e/RLS, e nenhum PR passa no review sem atender à §12.10 (Definition of Done).
