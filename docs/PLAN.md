# Plano de Implementação — ERP Modular (MVP)

> **Stack:** Next.js 14+ (App Router, Server Actions, TypeScript) · Supabase (Postgres, Auth, RLS) · Tailwind CSS + Shadcn/UI · Vercel
> **Arquitetura:** Modular "Plug and Play" — cada domínio é isolado em `src/modules/<domínio>` com seus próprios actions, components, hooks, schemas e types.
> **Autor:** Yuri · **Criado em:** 2026-04-20

---

## Sumário

1. [Visão Geral e Princípios Arquiteturais](#1-visão-geral-e-princípios-arquiteturais)
2. [Estrutura de Pastas](#2-estrutura-de-pastas)
3. [Fase 1 — Setup do Projeto](#3-fase-1--setup-do-projeto)
4. [Fase 2 — Banco de Dados, RLS e Tipagem](#4-fase-2--banco-de-dados-rls-e-tipagem)
5. [Fase 3 — Módulo de Autenticação (Auth)](#5-fase-3--módulo-de-autenticação-auth)
6. [Fase 4 — Módulo de Estoque (Backend)](#6-fase-4--módulo-de-estoque-backend)
7. [Fase 5 — Módulo de Estoque (Frontend)](#7-fase-5--módulo-de-estoque-frontend)
8. [Convenções e Padrões de Projeto](#8-convenções-e-padrões-de-projeto)
9. [Checklist Geral do MVP](#9-checklist-geral-do-mvp)
10. [Roadmap Pós-MVP](#10-roadmap-pós-mvp)

---

## 1. Visão Geral e Princípios Arquiteturais

### 1.1 Objetivo

Entregar um ERP web, escalável e modular, com MVP focado em três domínios: **Auth**, **Produtos** e **Movimentações de Estoque**. A base deve permitir que novos módulos (Orçamentos, Clientes, Financeiro, etc.) sejam anexados sem tocar no _core_.

### 1.2 Princípios

- **Modularidade "Plug and Play":** cada módulo vive em `src/modules/<dominio>` e expõe uma API pública via `index.ts` (barrel). O _core_ (`src/core`, `src/lib`, `src/app`) não importa nada interno de um módulo.
- **Server-first:** preferir **React Server Components** + **Server Actions**. Rotas de API (route handlers) apenas para webhooks e integrações externas.
- **Segurança em camadas:** RLS no banco, validação com Zod nas actions, e autorização por _role_ em middlewares de módulo.
- **Tipagem ponta-a-ponta:** `database.types.ts` gerado pela CLI do Supabase é a fonte da verdade; DTOs/schemas derivam dele via Zod.
- **Componentização:** UI baseada em Shadcn/UI. Componentes de domínio ficam no módulo; componentes reutilizáveis de UI ficam em `src/components/ui`.
- **DX:** TypeScript `strict`, ESLint + Prettier, Husky + lint-staged, CI na Vercel.

### 1.3 Camadas de um Módulo

```
src/modules/<dominio>/
├── actions/          # Server Actions (mutations)
├── queries/          # Funções de leitura (server-only)
├── components/       # Componentes React do domínio
├── hooks/            # Hooks client-side
├── schemas/          # Zod schemas (input/output)
├── types/            # Tipos derivados + enums
├── services/         # Regras de negócio puras (testáveis)
├── constants.ts
└── index.ts          # Barrel — única API pública do módulo
```

---

## 2. Estrutura de Pastas

```
erp/
├── docs/
│   └── PLAN.md
├── public/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/                   # Rotas públicas de login/cadastro
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── recover/page.tsx
│   │   ├── (dashboard)/              # Rotas protegidas
│   │   │   ├── layout.tsx            # Guard de sessão + Shell
│   │   │   ├── page.tsx              # Home do dashboard
│   │   │   └── inventory/
│   │   │       ├── page.tsx          # Lista de produtos
│   │   │       ├── new/page.tsx
│   │   │       ├── [id]/page.tsx
│   │   │       └── movements/page.tsx
│   │   ├── api/
│   │   │   └── auth/callback/route.ts  # OAuth callback (Google)
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── error.tsx
│   ├── core/
│   │   ├── config/env.ts             # Validação de envs com Zod
│   │   └── navigation/menu.ts        # Registro de módulos no menu
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── server.ts             # createServerClient (RSC/Actions)
│   │   │   ├── client.ts             # createBrowserClient
│   │   │   └── middleware.ts         # refresh de sessão
│   │   ├── utils.ts                  # cn(), formatters
│   │   └── errors.ts                 # AppError, fromZodError
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── actions/
│   │   │   │   ├── sign-in.ts
│   │   │   │   ├── sign-up.ts
│   │   │   │   ├── sign-out.ts
│   │   │   │   ├── recover-password.ts
│   │   │   │   └── sign-in-google.ts
│   │   │   ├── components/
│   │   │   │   ├── sign-in-form.tsx
│   │   │   │   ├── sign-up-form.tsx
│   │   │   │   ├── recover-form.tsx
│   │   │   │   └── google-button.tsx
│   │   │   ├── queries/get-current-user.ts
│   │   │   ├── schemas/index.ts
│   │   │   ├── services/profile-service.ts
│   │   │   └── index.ts
│   │   └── inventory/
│   │       ├── actions/
│   │       │   ├── create-product.ts
│   │       │   ├── update-product.ts
│   │       │   ├── delete-product.ts
│   │       │   └── register-movement.ts
│   │       ├── queries/
│   │       │   ├── list-products.ts
│   │       │   ├── get-product.ts
│   │       │   └── list-movements.ts
│   │       ├── components/
│   │       │   ├── product-form.tsx
│   │       │   ├── product-table.tsx
│   │       │   ├── movement-form.tsx
│   │       │   └── movement-table.tsx
│   │       ├── services/stock-service.ts
│   │       ├── schemas/index.ts
│   │       ├── types/index.ts
│   │       └── index.ts
│   ├── components/
│   │   └── ui/                       # Shadcn (button, input, table...)
│   ├── types/
│   │   └── database.types.ts         # Gerado pela Supabase CLI
│   └── middleware.ts                 # Protege rotas + refresh de sessão
├── supabase/
│   ├── migrations/
│   │   ├── 20260420_00_init.sql
│   │   ├── 20260420_01_profiles.sql
│   │   ├── 20260420_02_products.sql
│   │   ├── 20260420_03_stock_movements.sql
│   │   └── 20260420_04_rls_policies.sql
│   ├── seed.sql
│   └── config.toml
├── .env.local.example
├── .eslintrc.cjs
├── .prettierrc
├── components.json                   # Shadcn config
├── next.config.mjs
├── package.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

## 3. Fase 1 — Setup do Projeto

### 3.1 Criação do Projeto

```bash
# 1. Criar o projeto Next.js
pnpm create next-app@latest erp \
  --typescript --eslint --tailwind --app \
  --src-dir --import-alias "@/*" --use-pnpm

cd erp

# 2. Dependências Supabase
pnpm add @supabase/supabase-js @supabase/ssr

# 3. Utilitários
pnpm add zod react-hook-form @hookform/resolvers
pnpm add lucide-react clsx tailwind-merge class-variance-authority
pnpm add date-fns sonner

# 4. Dev
pnpm add -D @types/node supabase prettier prettier-plugin-tailwindcss \
  eslint-config-prettier husky lint-staged

# 5. Shadcn/UI
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button input label form card table \
  dialog dropdown-menu toast sonner separator badge skeleton \
  select textarea alert sheet
```

### 3.2 Variáveis de Ambiente

**`.env.local.example`**

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # Apenas server — NUNCA expor

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**`src/core/config/env.ts`** — validação com Zod na inicialização:

```ts
import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});
```

### 3.3 Clients Supabase (SSR)

**`src/lib/supabase/server.ts`**

```ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";
import { env } from "@/core/config/env";

export function createClient() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: (name, value, options: CookieOptions) => {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {}
        },
        remove: (name, options: CookieOptions) => {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {}
        },
      },
    },
  );
}
```

**`src/lib/supabase/client.ts`**

```ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";
import { env } from "@/core/config/env";

export const createClient = () =>
  createBrowserClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
```

**`src/middleware.ts`** — refresh de sessão + guard de rotas protegidas:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_ROUTES = ["/login", "/register", "/recover", "/api/auth/callback"];

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => request.cookies.get(name)?.value,
        set: (name, value, options) => {
          request.cookies.set({ name, value, ...options });
          response.cookies.set({ name, value, ...options });
        },
        remove: (name, options) => {
          request.cookies.set({ name, value: "", ...options });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_ROUTES.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }
  if (user && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg)).*)"],
};
```

### 3.4 Tailwind + Shadcn

- Executar `pnpm dlx shadcn@latest init` e aceitar: Style `Default`, color base `Slate`, CSS variables `true`.
- Adicionar `@tailwindcss/forms` e `@tailwindcss/typography` se necessário.
- Criar tema escuro/claro com `next-themes` (opcional no MVP).

### 3.5 Qualidade & CI

- `pnpm lint` + `pnpm format` no pre-commit via **Husky + lint-staged**.
- Configurar **Vercel** com Git integration; envs replicadas em _Preview_ e _Production_.
- Habilitar preview deploys por PR.

---

## 4. Fase 2 — Banco de Dados, RLS e Tipagem

### 4.1 Inicialização local

```bash
pnpm supabase init
pnpm supabase login
pnpm supabase link --project-ref <ref>
pnpm supabase start            # Postgres local
```

### 4.2 Migrations

**`supabase/migrations/20260420_00_init.sql`**

```sql
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";
```

**`supabase/migrations/20260420_01_profiles.sql`**

```sql
create type public.user_role as enum ('admin', 'manager', 'operator');

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null,
  role         public.user_role not null default 'operator',
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Sincroniza profile automaticamente quando usuário é criado em auth.users
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'operator'
  );
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
```

**`supabase/migrations/20260420_02_products.sql`**

```sql
create table public.products (
  id           uuid primary key default gen_random_uuid(),
  sku          text not null unique,
  name         text not null,
  description  text,
  unit         text not null default 'UN',                -- UN, KG, L, CX...
  cost_price   numeric(12,2) not null default 0 check (cost_price >= 0),
  sale_price   numeric(12,2) not null default 0 check (sale_price >= 0),
  stock        numeric(12,3) not null default 0,          -- Saldo calculado
  min_stock    numeric(12,3) not null default 0,
  is_active    boolean not null default true,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_products_sku on public.products(sku);
create index idx_products_name on public.products using gin (to_tsvector('portuguese', name));
```

**`supabase/migrations/20260420_03_stock_movements.sql`**

```sql
create type public.movement_type as enum ('in', 'out', 'adjustment');

create table public.stock_movements (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products(id) on delete restrict,
  movement_type  public.movement_type not null,
  quantity       numeric(12,3) not null check (quantity > 0),
  unit_cost      numeric(12,2),
  reason         text,
  performed_by   uuid not null references auth.users(id),
  created_at     timestamptz not null default now()
);

create index idx_stock_movements_product on public.stock_movements(product_id, created_at desc);

-- Trigger que atualiza products.stock de forma atômica
create or replace function public.apply_stock_movement()
returns trigger language plpgsql as $$
begin
  if new.movement_type = 'in' then
    update public.products set stock = stock + new.quantity, updated_at = now()
      where id = new.product_id;
  elsif new.movement_type = 'out' then
    update public.products set stock = stock - new.quantity, updated_at = now()
      where id = new.product_id;
    if (select stock from public.products where id = new.product_id) < 0 then
      raise exception 'Estoque insuficiente para o produto %', new.product_id;
    end if;
  elsif new.movement_type = 'adjustment' then
    update public.products set stock = new.quantity, updated_at = now()
      where id = new.product_id;
  end if;
  return new;
end $$;

create trigger trg_apply_stock_movement
after insert on public.stock_movements
for each row execute function public.apply_stock_movement();
```

**`supabase/migrations/20260420_04_rls_policies.sql`**

```sql
-- Helper: role do usuário logado
create or replace function public.current_user_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

alter table public.profiles        enable row level security;
alter table public.products        enable row level security;
alter table public.stock_movements enable row level security;

-- PROFILES: usuário vê/edita o próprio; admin vê todos
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.current_user_role() = 'admin');

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- PRODUCTS: qualquer autenticado lê; manager/admin escreve
create policy "products_select_authenticated" on public.products
  for select using (auth.role() = 'authenticated');

create policy "products_write_manager" on public.products
  for all using (public.current_user_role() in ('admin', 'manager'))
  with check (public.current_user_role() in ('admin', 'manager'));

-- MOVEMENTS: autenticado lê; qualquer autenticado insere (assinatura via performed_by)
create policy "movements_select_authenticated" on public.stock_movements
  for select using (auth.role() = 'authenticated');

create policy "movements_insert_authenticated" on public.stock_movements
  for insert with check (performed_by = auth.uid());
```

### 4.3 Aplicar migrations e gerar tipos

```bash
pnpm supabase db push                         # aplica ao projeto linkado
pnpm supabase gen types typescript \
  --linked --schema public \
  > src/types/database.types.ts
```

Adicionar script ao `package.json`:

```json
{
  "scripts": {
    "db:types": "supabase gen types typescript --linked --schema public > src/types/database.types.ts",
    "db:push": "supabase db push",
    "db:reset": "supabase db reset"
  }
}
```

---

## 5. Fase 3 — Módulo de Autenticação (Auth)

### 5.1 Schemas (`src/modules/auth/schemas/index.ts`)

```ts
import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
});

export const signUpSchema = z
  .object({
    fullName: z.string().min(3, "Informe seu nome"),
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não coincidem",
  });

export const recoverSchema = z.object({ email: z.string().email() });

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type RecoverInput = z.infer<typeof recoverSchema>;
```

### 5.2 Server Actions

**`src/modules/auth/actions/sign-in.ts`**

```ts
"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { signInSchema } from "../schemas";
import type { ActionResult } from "@/lib/errors";

export async function signInAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, message: "Credenciais inválidas" };

  revalidatePath("/", "layout");
  redirect("/");
}
```

**`src/modules/auth/actions/sign-up.ts`**

```ts
"use server";
import { createClient } from "@/lib/supabase/server";
import { signUpSchema } from "../schemas";
import { env } from "@/core/config/env";
import type { ActionResult } from "@/lib/errors";

export async function signUpAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { fullName, email, password } = parsed.data;
  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
    },
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Verifique seu email para confirmar a conta." };
}
```

**`src/modules/auth/actions/sign-in-google.ts`**

```ts
"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/core/config/env";

export async function signInGoogleAction() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${env.NEXT_PUBLIC_APP_URL}/api/auth/callback` },
  });
  if (error) throw error;
  redirect(data.url);
}
```

**`src/modules/auth/actions/recover-password.ts`**

```ts
"use server";
import { createClient } from "@/lib/supabase/server";
import { recoverSchema } from "../schemas";
import { env } from "@/core/config/env";
import type { ActionResult } from "@/lib/errors";

export async function recoverPasswordAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = recoverSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.NEXT_PUBLIC_APP_URL}/recover/reset`,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Se o email existir, enviaremos um link." };
}
```

**`src/modules/auth/actions/sign-out.ts`**

```ts
"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function signOutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
```

### 5.3 Route Handler — Callback OAuth

**`src/app/api/auth/callback/route.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
```

### 5.4 UI — Formulário de Login

**`src/modules/auth/components/sign-in-form.tsx`**

```tsx
"use client";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAction } from "../actions/sign-in";
import { GoogleButton } from "./google-button";

const initial = { ok: false } as const;

export function SignInForm() {
  const [state, formAction] = useFormState(signInAction, initial);
  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
        {state.fieldErrors?.email && (
          <p className="text-sm text-red-600">{state.fieldErrors.email[0]}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
        {state.fieldErrors?.password && (
          <p className="text-sm text-red-600">{state.fieldErrors.password[0]}</p>
        )}
      </div>
      {state.message && !state.ok && <p className="text-sm text-red-600">{state.message}</p>}
      <SubmitButton />
      <div className="relative my-4 text-center text-xs text-muted-foreground">
        <span className="bg-background px-2">ou</span>
      </div>
      <GoogleButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Entrando..." : "Entrar"}
    </Button>
  );
}
```

### 5.5 Configurações no Supabase Dashboard

- **Authentication › Providers › Google:** habilitar, colar _Client ID_ e _Client Secret_.
- **Redirect URLs:** `http://localhost:3000/api/auth/callback` e `https://<dominio>.vercel.app/api/auth/callback`.
- **Email Templates:** personalizar confirmação, reset e magic link em português.
- **SMTP:** configurar provedor próprio (Resend/SendGrid) antes de produção.

---

## 6. Fase 4 — Módulo de Estoque (Backend)

### 6.1 Schemas (`src/modules/inventory/schemas/index.ts`)

```ts
import { z } from "zod";

export const productSchema = z.object({
  sku: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[A-Z0-9\-]+$/i, "SKU alfanumérico"),
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional().nullable(),
  unit: z.enum(["UN", "KG", "L", "CX", "M"]),
  costPrice: z.coerce.number().nonnegative(),
  salePrice: z.coerce.number().nonnegative(),
  minStock: z.coerce.number().nonnegative().default(0),
  isActive: z.coerce.boolean().default(true),
});

export const movementSchema = z.object({
  productId: z.string().uuid(),
  type: z.enum(["in", "out", "adjustment"]),
  quantity: z.coerce.number().positive(),
  unitCost: z.coerce.number().nonnegative().optional(),
  reason: z.string().max(500).optional(),
});

export const listProductsSchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  onlyActive: z.coerce.boolean().default(true),
});

export type ProductInput = z.infer<typeof productSchema>;
export type MovementInput = z.infer<typeof movementSchema>;
```

### 6.2 Service (regra de negócio pura)

**`src/modules/inventory/services/stock-service.ts`**

```ts
import type { MovementInput } from "../schemas";

export class InsufficientStockError extends Error {
  constructor(productId: string) {
    super(`Estoque insuficiente: ${productId}`);
  }
}

/** Valida localmente antes de chamar o banco (UX). Banco tem a verdade via trigger. */
export function validateMovement(input: MovementInput, currentStock: number): void {
  if (input.type === "out" && input.quantity > currentStock) {
    throw new InsufficientStockError(input.productId);
  }
}
```

### 6.3 Server Actions

**`src/modules/inventory/actions/create-product.ts`**

```ts
"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { productSchema } from "../schemas";
import type { ActionResult } from "@/lib/errors";

export async function createProductAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = productSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Não autenticado" };

  const { error } = await supabase.from("products").insert({
    sku: parsed.data.sku.toUpperCase(),
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    unit: parsed.data.unit,
    cost_price: parsed.data.costPrice,
    sale_price: parsed.data.salePrice,
    min_stock: parsed.data.minStock,
    is_active: parsed.data.isActive,
    created_by: user.id,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/inventory");
  return { ok: true, message: "Produto cadastrado" };
}
```

**`src/modules/inventory/actions/register-movement.ts`**

```ts
"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { movementSchema } from "../schemas";
import { validateMovement } from "../services/stock-service";
import type { ActionResult } from "@/lib/errors";

export async function registerMovementAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = movementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Não autenticado" };

  // Pré-validação (UX)
  const { data: product, error: pErr } = await supabase
    .from("products")
    .select("stock")
    .eq("id", parsed.data.productId)
    .single();
  if (pErr || !product) return { ok: false, message: "Produto não encontrado" };
  try {
    validateMovement(parsed.data, Number(product.stock));
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  const { error } = await supabase.from("stock_movements").insert({
    product_id: parsed.data.productId,
    movement_type: parsed.data.type,
    quantity: parsed.data.quantity,
    unit_cost: parsed.data.unitCost ?? null,
    reason: parsed.data.reason ?? null,
    performed_by: user.id,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/inventory");
  revalidatePath("/inventory/movements");
  return { ok: true, message: "Movimentação registrada" };
}
```

### 6.4 Queries (leitura)

**`src/modules/inventory/queries/list-products.ts`**

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listProductsSchema } from "../schemas";

export async function listProducts(raw: Record<string, unknown>) {
  const { q, page, pageSize, onlyActive } = listProductsSchema.parse(raw);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = createClient();
  let query = supabase
    .from("products")
    .select("*", { count: "exact" })
    .order("name")
    .range(from, to);
  if (onlyActive) query = query.eq("is_active", true);
  if (q) query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%`);

  const { data, count, error } = await query;
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0, page, pageSize };
}
```

### 6.5 Tipos utilitários (`src/lib/errors.ts`)

```ts
export type FieldErrors = Record<string, string[] | undefined>;

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; message?: string; fieldErrors?: FieldErrors };

export class AppError extends Error {
  constructor(
    message: string,
    public code: string = "APP_ERROR",
  ) {
    super(message);
  }
}
```

---

## 7. Fase 5 — Módulo de Estoque (Frontend)

### 7.1 Listagem de Produtos (Server Component)

**`src/app/(dashboard)/inventory/page.tsx`**

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { listProducts } from "@/modules/inventory/queries/list-products";
import { ProductTable } from "@/modules/inventory/components/product-table";

type Props = { searchParams: Record<string, string> };

export default async function InventoryPage({ searchParams }: Props) {
  const { data, total, page, pageSize } = await listProducts(searchParams);
  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Estoque</h1>
          <p className="text-sm text-muted-foreground">{total} produtos cadastrados</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/inventory/movements">Movimentações</Link>
          </Button>
          <Button asChild>
            <Link href="/inventory/new">+ Novo produto</Link>
          </Button>
        </div>
      </header>
      <ProductTable items={data} page={page} pageSize={pageSize} total={total} />
    </section>
  );
}
```

### 7.2 Tabela de Produtos

**`src/modules/inventory/components/product-table.tsx`**

```tsx
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/types/database.types";

type Product = Database["public"]["Tables"]["products"]["Row"];

type Props = { items: Product[]; page: number; pageSize: number; total: number };

export function ProductTable({ items }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>SKU</TableHead>
          <TableHead>Produto</TableHead>
          <TableHead className="text-right">Estoque</TableHead>
          <TableHead className="text-right">Custo</TableHead>
          <TableHead className="text-right">Venda</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="font-mono text-xs">{p.sku}</TableCell>
            <TableCell>
              <Link href={`/inventory/${p.id}`} className="hover:underline">
                {p.name}
              </Link>
            </TableCell>
            <TableCell className="text-right">
              {Number(p.stock).toFixed(3)} {p.unit}
            </TableCell>
            <TableCell className="text-right">R$ {Number(p.cost_price).toFixed(2)}</TableCell>
            <TableCell className="text-right">R$ {Number(p.sale_price).toFixed(2)}</TableCell>
            <TableCell>
              {Number(p.stock) <= Number(p.min_stock) ? (
                <Badge variant="destructive">Baixo</Badge>
              ) : (
                <Badge variant="secondary">OK</Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

### 7.3 Formulário de Produto (client)

**`src/modules/inventory/components/product-form.tsx`**

```tsx
"use client";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createProductAction } from "../actions/create-product";

const initial = { ok: false } as const;

export function ProductForm() {
  const [state, action] = useFormState(createProductAction, initial);
  return (
    <form action={action} className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field label="SKU" name="sku" error={state.fieldErrors?.sku?.[0]} required />
      <Field label="Nome" name="name" error={state.fieldErrors?.name?.[0]} required />
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="description">Descrição</Label>
        <Textarea id="description" name="description" rows={3} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="unit">Unidade</Label>
        <Select name="unit" defaultValue="UN">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["UN", "KG", "L", "CX", "M"].map((u) => (
              <SelectItem key={u} value={u}>
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Field label="Custo" name="costPrice" type="number" step="0.01" />
      <Field label="Venda" name="salePrice" type="number" step="0.01" />
      <Field label="Estoque mínimo" name="minStock" type="number" step="0.001" />
      <div className="flex justify-end md:col-span-2">
        <Submit />
      </div>
      {state.message && (
        <p className={`text-sm md:col-span-2 ${state.ok ? "text-emerald-600" : "text-red-600"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  error,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  error?: string;
  step?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        step={step}
        required={required}
        aria-invalid={!!error}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : "Salvar"}
    </Button>
  );
}
```

### 7.4 Registro de Movimentação

**`src/modules/inventory/components/movement-form.tsx`**

```tsx
"use client";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { registerMovementAction } from "../actions/register-movement";

const initial = { ok: false } as const;

type Product = { id: string; name: string; sku: string };

export function MovementForm({ products }: { products: Product[] }) {
  const [state, action] = useFormState(registerMovementAction, initial);
  return (
    <form action={action} className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="space-y-2 md:col-span-2">
        <Label>Produto</Label>
        <Select name="productId">
          <SelectTrigger>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.sku} — {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Tipo</Label>
        <Select name="type" defaultValue="in">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="in">Entrada</SelectItem>
            <SelectItem value="out">Saída</SelectItem>
            <SelectItem value="adjustment">Ajuste</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="quantity">Quantidade</Label>
        <Input id="quantity" name="quantity" type="number" step="0.001" required />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="reason">Motivo (opcional)</Label>
        <Input id="reason" name="reason" />
      </div>
      <div className="flex justify-end md:col-span-2">
        <Submit />
      </div>
      {state.message && (
        <p className={`text-sm md:col-span-2 ${state.ok ? "text-emerald-600" : "text-red-600"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Registrando..." : "Registrar"}
    </Button>
  );
}
```

### 7.5 Shell do Dashboard

**`src/app/(dashboard)/layout.tsx`**

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/modules/auth";
import { Button } from "@/components/ui/button";
import { MODULES_MENU } from "@/core/navigation/menu";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr]">
      <aside className="border-r bg-muted/30 p-4">
        <h2 className="mb-6 text-lg font-semibold">ERP</h2>
        <nav className="flex flex-col gap-1">
          {MODULES_MENU.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded px-3 py-2 text-sm hover:bg-accent"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="p-8">
        <div className="mb-4 flex justify-end">
          <form action={signOutAction}>
            <Button variant="ghost" size="sm">
              Sair
            </Button>
          </form>
        </div>
        {children}
      </main>
    </div>
  );
}
```

**`src/core/navigation/menu.ts`** — registro central para o sistema "plug and play":

```ts
export type MenuItem = { label: string; href: string; icon?: string; roles?: string[] };

export const MODULES_MENU: MenuItem[] = [
  { label: "Início", href: "/" },
  { label: "Estoque", href: "/inventory" },
  { label: "Movimentações", href: "/inventory/movements" },
  // Novos módulos se registram aqui sem alterar o layout.
];
```

---

## 8. Convenções e Padrões de Projeto

### 8.1 Commits e branches

- **Conventional Commits** (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`).
- Branches: `main` (produção) · `develop` (staging) · `feature/<modulo>-<descricao>`.

### 8.2 Qualidade de código

- `tsconfig.json` com `"strict": true`, `"noUncheckedIndexedAccess": true`.
- ESLint `next/core-web-vitals` + regra customizada que **impede `import` de arquivos internos de outro módulo** (forçar uso do `index.ts`).
- Prettier + `prettier-plugin-tailwindcss`.

### 8.3 Padrões de Design (code level)

- **Barrel pattern** por módulo (`index.ts` como única porta de entrada).
- **Service/Repository** dentro de cada módulo separa regra de negócio de acesso a dados.
- **Dependency injection** leve via parâmetros (nada de globais).
- **Single Responsibility:** cada action/query faz uma coisa.
- **DTO via Zod:** validação e inferência de tipos no mesmo lugar.
- **Composição > herança** nos componentes (Shadcn já segue esse padrão).

### 8.4 Erros

- Nunca lançar `Error` cru nas actions — sempre retornar `ActionResult` tipado.
- Nível de transporte (Supabase) → mapear para mensagens humanas em português.

### 8.5 Testes (obrigatório em toda feature)

> **Política do projeto:** toda PR que altera comportamento **precisa vir com testes automatizados**. PRs sem testes são bloqueados no review. A estratégia completa (pirâmide, ferramentas, gates, Definition of Done) está detalhada em [`ARCHITECTURE-MULTITENANT.md` §12](./ARCHITECTURE-MULTITENANT.md#12-estratégia-de-testes-obrigatória-em-toda-feature) e se aplica ao MVP desde a Fase 1.

**Stack de testes**

- **Vitest** — testes unitários (services, schemas, helpers).
- **@testing-library/react** — componentes (render + interação).
- **Vitest + @supabase local** — Server Actions de ponta a ponta (com RLS real).
- **pgTAP** (`supabase test db`) — triggers e policies RLS direto no Postgres.
- **Playwright** — e2e dos fluxos críticos (login, cadastro, criar produto, registrar movimento).

**Matriz mínima por feature**

| Cenário                                            | Tipo             |    Obrigatório    |
| :------------------------------------------------- | :--------------- | :---------------: |
| Input válido → sucesso                             | integration      |        ✅         |
| Input inválido → `fieldErrors` do Zod              | unit/integration |        ✅         |
| Usuário não autenticado → negado                   | integration      |        ✅         |
| Regra de negócio específica (ex: estoque negativo) | unit no service  |        ✅         |
| Trigger/policy do banco                            | pgTAP            | ✅ (se aplicável) |

**Scripts**

```bash
pnpm test           # vitest run
pnpm test:watch     # vitest em modo watch
pnpm test:rls       # supabase test db (pgTAP)
pnpm test:e2e       # playwright
pnpm test:coverage  # relatório HTML + gate 80%
pnpm test:ci        # suite completa (roda no GitHub Actions)
```

**Gates de cobertura**

- Total: **80%** de linhas.
- `modules/**/services/**`: **95%**.
- `modules/**/actions/**`: **85%**.
- pgTAP: 100% dos arquivos passam.
- Playwright: 100% dos cenários críticos.

**Setup na Fase 1**

A configuração do runner de testes faz parte do Sprint Zero — não é opcional:

```bash
pnpm add -D vitest @vitejs/plugin-react jsdom \
  @testing-library/react @testing-library/user-event @testing-library/jest-dom \
  @playwright/test @vitest/coverage-v8
pnpm exec playwright install --with-deps
```

Adicionar `vitest.config.ts` com `projects` separados (`unit` e `integration`), e `playwright.config.ts` com fixtures de personas (Owner/Manager/Operator) a serem reutilizadas nos e2e.

### 8.6 Observabilidade

- Vercel Analytics + Speed Insights.
- `console.error` → `@sentry/nextjs` (pós-MVP).
- Logs estruturados em Server Actions com `request_id` (UUID por request).

---

## 9. Checklist Geral do MVP

### Fase 1 — Setup

- [ ] `pnpm create next-app` executado com App Router + TS + Tailwind
- [ ] Supabase SDK (`@supabase/supabase-js`, `@supabase/ssr`) instalado
- [ ] Shadcn/UI inicializado e componentes base adicionados
- [ ] Estrutura de pastas modular criada (`src/modules`, `src/core`, `src/lib`)
- [ ] `src/core/config/env.ts` validando envs
- [ ] Clients Supabase (`server.ts`, `client.ts`) + `middleware.ts` protegendo rotas
- [ ] Husky + lint-staged + Prettier configurados
- [ ] Projeto conectado ao Git e à Vercel
- [ ] **Runner de testes instalado:** Vitest + Testing Library + Playwright + @vitest/coverage-v8
- [ ] **`vitest.config.ts` com projects `unit` e `integration`**
- [ ] **`playwright.config.ts` com fixtures de personas (owner/manager/operator)**
- [ ] **Pipeline CI (GitHub Actions) executa `test:ci` em todo PR**
- [ ] **Teste "hello world" rodando em cada camada (unit / integration / e2e) para validar setup**

### Fase 2 — Banco

- [ ] Projeto Supabase criado e linkado (`supabase link`)
- [ ] Migrations criadas: `profiles`, `products`, `stock_movements`, RLS
- [ ] Trigger `handle_new_user` funcionando
- [ ] Trigger `apply_stock_movement` atualizando saldo
- [ ] RLS habilitado e policies testadas (admin/manager/operator)
- [ ] `src/types/database.types.ts` gerado via `pnpm db:types`
- [ ] **pgTAP: `01_triggers.test.sql` cobre `apply_stock_movement` (entrada, saída, saída negativa → erro)**
- [ ] **pgTAP: `02_triggers.test.sql` cobre `handle_new_user` (cria profile ao inserir auth.user)**
- [ ] **pgTAP: `03_rls.test.sql` cobre policies de products e movements**
- [ ] **`pnpm test:rls` passa no CI**

### Fase 3 — Auth

- [ ] Server Actions: `signIn`, `signUp`, `signOut`, `recoverPassword`, `signInGoogle`
- [ ] Google OAuth habilitado no Supabase (client/secret configurados)
- [ ] Callback `/api/auth/callback` trocando code por sessão
- [ ] Páginas `/login`, `/register`, `/recover` com formulários validados
- [ ] Redirect para `/login` quando não autenticado (middleware)
- [ ] `getCurrentUser()` exposto via `src/modules/auth/index.ts`
- [ ] **Unit: `schemas/index.test.ts` cobre `signInSchema`, `signUpSchema`, `recoverSchema` (happy + edge cases)**
- [ ] **Integration: `sign-in.test.ts` — credenciais válidas, inválidas, email não-confirmado**
- [ ] **Integration: `sign-up.test.ts` — cria user + profile via trigger; rejeita senhas fracas**
- [ ] **Integration: `recover-password.test.ts` — envia email mesmo para email inexistente (antienum)**
- [ ] **Component: `sign-in-form.test.tsx` — exibe `fieldErrors`, desabilita submit durante pending**
- [ ] **E2E: `auth.e2e.ts` — fluxo completo login → dashboard → logout**

### Fase 4 — Estoque (Backend)

- [ ] Schemas Zod para `product` e `movement`
- [ ] Actions: `createProduct`, `updateProduct`, `deleteProduct`, `registerMovement`
- [ ] Queries: `listProducts` (paginado + busca), `getProduct`, `listMovements`
- [ ] `stock-service.ts` com regras puras + testes unitários
- [ ] `revalidatePath` em todas as mutações
- [ ] Erros tratados e retornados como `ActionResult`
- [ ] **Unit: `stock-service.test.ts` — `validateMovement` em todos os 4 cenários (in, out ok, out > stock, adjustment)**
- [ ] **Integration: `create-product.test.ts` — sucesso, SKU duplicado, validação Zod, não-autenticado**
- [ ] **Integration: `register-movement.test.ts` — entrada atualiza stock, saída insuficiente → erro, ajuste sobrescreve**
- [ ] **Integration: `list-products.test.ts` — paginação, busca por nome/SKU, filtro `onlyActive`**
- [ ] **Cobertura ≥ 95% em `services/`, ≥ 85% em `actions/`**

### Fase 5 — Estoque (Frontend)

- [ ] Página `/inventory` (listagem paginada + busca)
- [ ] Página `/inventory/new` (form de criação)
- [ ] Página `/inventory/[id]` (detalhe + edição)
- [ ] Página `/inventory/movements` (form + histórico)
- [ ] `ProductTable`, `ProductForm`, `MovementForm`, `MovementTable`
- [ ] Badge de "estoque baixo" quando `stock <= min_stock`
- [ ] Toasts (Sonner) em sucesso/erro das actions
- [ ] Layout `(dashboard)` com sidebar consumindo `MODULES_MENU`
- [ ] **Component: `product-form.test.tsx` — validação, erros, estado pending**
- [ ] **Component: `product-table.test.tsx` — render, badge "Baixo" quando aplicável, link para detalhe**
- [ ] **Component: `movement-form.test.tsx` — seleção de produto, tipo, quantidade, submit**
- [ ] **E2E: `inventory.e2e.ts` — criar produto → registrar entrada → ver saldo atualizado → registrar saída**
- [ ] **E2E: `inventory-negative.e2e.ts` — tentar saída > estoque e confirmar mensagem de erro**

### Qualidade

- [ ] `pnpm lint` sem erros
- [ ] `pnpm typecheck` sem erros
- [ ] Build Vercel (`pnpm build`) passando
- [ ] **`pnpm test:ci` verde — unit + integration + pgTAP + e2e**
- [ ] **Cobertura total ≥ 80% (gate no CI)**
- [ ] **Nenhum teste `skip` ou `only` no main**
- [ ] **Tempo total da suíte de testes ≤ 5 min em CI**
- [ ] README com passo-a-passo de setup local **+ como rodar os testes**

---

## 10. Roadmap Pós-MVP

| Ordem | Módulo                   | Notas                                                        |
| :---: | :----------------------- | :----------------------------------------------------------- |
|   1   | **Orçamentos**           | `src/modules/quotes` — reaproveita `products` + `profiles`.  |
|   2   | **Clientes (CRM light)** | `src/modules/customers` — PF/PJ, contatos, endereços.        |
|   3   | **Fornecedores**         | `src/modules/suppliers` — integra com movimentos de entrada. |
|   4   | **Financeiro básico**    | Contas a pagar/receber, conciliação manual.                  |
|   5   | **Relatórios**           | Curva ABC, giro de estoque, DRE gerencial.                   |
|   6   | **Auditoria**            | `audit_logs` + middleware para registrar actions.            |
|   7   | **Multi-tenant (Orgs)**  | Coluna `org_id` em todas as tabelas + RLS por org.           |
|   8   | **Mobile (PWA)**         | Leitura de código de barras para movimentações.              |

Cada novo módulo segue o mesmo _blueprint_: migration própria → RLS → schemas → actions → queries → componentes → registro em `MODULES_MENU`. **Nenhum core é modificado.**

---

> **Próximo passo sugerido:** aprovar este plano e iniciar a **Fase 1 (Setup)**. Assim que o repositório estiver criado e linkado à Vercel, partimos para a Fase 2 (Banco).
