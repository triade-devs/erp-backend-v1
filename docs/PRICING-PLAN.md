# Plano de Precificação — ERP

> Documento de referência cobrindo (1) estratégia comercial de precificação e (2) blueprint técnico do módulo `billing` dentro da arquitetura do projeto (Next.js 15 + Supabase + RLS, padrão modular com `ActionResult`).

---

## Parte 1 — Estratégia comercial

### 1.1. Princípios

1. **Precificar por valor, não por custo.** O ERP reduz retrabalho, erros de estoque e atrasos fiscais. Ancore a mensagem em ROI (ex.: "evita R$ X em rupturas de estoque"), não em "R$ por funcionalidade".
2. **Modelo híbrido em 3 camadas:** tier flat (pacote de features + limites) + seats (usuários extras) + overages (quando ultrapassar o limite de volume). Isso cobre os três modelos que você escolheu sem canibalizar nenhum.
3. **Boa-escada (good / better / best / enterprise):** quatro tiers para criar "preço âncora", facilitar upsell e capturar desde a pequena loja até a grande operação.
4. **Annual discount de 17–20%** (equivalente a "2 meses grátis") para previsibilidade de receita e redução de churn.
5. **Trial de 14 dias** no Pro/Business (sem cartão) + **Free forever** limitado (entrada de funil).

### 1.2. Tiers sugeridos

| Plano          | Preço (mensal, anual) | Público           | Usuários inclusos | Limite de produtos | Movimentações/mês |
| -------------- | --------------------- | ----------------- | ----------------- | ------------------ | ----------------- |
| **Free**       | R$ 0                  | Teste / micro     | 1                 | 50                 | 200               |
| **Starter**    | R$ 79 / R$ 790 ano    | Pequenas empresas | 3                 | 500                | 2.000             |
| **Pro**        | R$ 249 / R$ 2.490 ano | Médias            | 10                | 5.000              | 20.000            |
| **Business**   | R$ 599 / R$ 5.990 ano | Médias-grandes    | 25                | 50.000             | 200.000           |
| **Enterprise** | Sob consulta          | Grandes           | Ilimitado         | Ilimitado          | Ilimitado + SLA   |

**Add-ons transversais (qualquer plano pago):**

- **Usuário adicional:** R$ 29/mês (Starter), R$ 39/mês (Pro), R$ 49/mês (Business).
- **Overage de movimentação:** R$ 0,02 por movimentação acima do limite (ou upgrade automático sugerido).
- **Integrações premium:** NF-e, marketplaces, ERP contábil — R$ 49–149/mês cada.
- **Onboarding assistido:** R$ 990 one-time (obrigatório no Enterprise, opcional no Business).

### 1.3. Matriz de features por tier (gating)

| Feature                                     | Free | Starter |   Pro    | Business | Enterprise |
| ------------------------------------------- | :--: | :-----: | :------: | :------: | :--------: |
| Produtos e estoque                          |  ✓   |    ✓    |    ✓     |    ✓     |     ✓      |
| Movimentações de estoque                    |  ✓   |    ✓    |    ✓     |    ✓     |     ✓      |
| Relatórios básicos                          |  ✓   |    ✓    |    ✓     |    ✓     |     ✓      |
| Controle de papéis (admin/manager/operator) |  —   |    ✓    |    ✓     |    ✓     |     ✓      |
| Múltiplos depósitos                         |  —   |    —    |    ✓     |    ✓     |     ✓      |
| Integração NF-e                             |  —   |    —    |  Add-on  |    ✓     |     ✓      |
| API pública + Webhooks                      |  —   |    —    | Limitado |    ✓     |     ✓      |
| Auditoria completa                          |  —   |    —    |    ✓     |    ✓     |     ✓      |
| SSO (Google/Microsoft)                      |  —   |    —    |    —     |    ✓     |     ✓      |
| Relatórios customizáveis / BI               |  —   |    —    |    —     |    ✓     |     ✓      |
| SLA contratual                              |  —   |    —    |    —     |    —     |     ✓      |
| Ambiente dedicado / on-premises             |  —   |    —    |    —     |    —     |     ✓      |
| Gerente de conta                            |  —   |    —    |    —     |    —     |     ✓      |

### 1.4. Posicionamento e comunicação

- **Free** — "Experimente o ERP completo, sem cartão." (captura de leads, SEO, comunidade).
- **Starter** — "Organize seu estoque e fiscal do seu jeito." (foco em dor: planilha caótica).
- **Pro** — "Escale sem caos: múltiplos depósitos e auditoria." (marco de crescimento).
- **Business** — "Operação madura com SSO, BI e integrações." (compras comitê, TI envolvido).
- **Enterprise** — "Parceria estratégica: SLA, ambiente dedicado e customizações."

### 1.5. Precificação psicológica

- Preço-âncora: mostrar Business destacado na tabela, fazendo o Pro parecer "a escolha inteligente".
- Terminações em 9 (79, 249, 599) — conversão ~15% maior que preços redondos em B2B SMB.
- Exibir economia anual: "Economize R$ 598 pagando anual" em vez de "17% off".
- Calculadora interativa de ROI no site (ex.: "quantas rupturas você evita?").

### 1.6. Descontos e políticas

- **Anual:** 17–20% off (padrão).
- **ONGs/Educacional:** 50% off (mediante comprovação).
- **Multi-empresa (grupo):** 10% a partir de 3 subscrições Business.
- **Nunca negociar no Starter/Pro** (margem enxuta, canibalizaria o Business). Descontos só em Business/Enterprise, sempre com contrapartida (contrato 12m, case de sucesso, etc.).

### 1.7. Roadmap de precificação

1. **Mês 1–3:** Lançar Free + Starter + Pro. Validar willingness-to-pay. Não lance Business ainda.
2. **Mês 4–6:** Com ~30 clientes pagantes, introduzir Business e medir conversão Pro→Business.
3. **Mês 7+:** Enterprise sob consulta + expansion revenue (add-ons, overages). Revisar preços anualmente ajustando por IPCA e valor percebido.

---

## Parte 2 — Blueprint técnico (módulo `billing`)

Seguindo a arquitetura definida em `CLAUDE.md`: cada feature em `src/modules/<domain>/` com barrel `index.ts`, Server Actions retornando `ActionResult`, queries com `"server-only"`, Zod nas entradas e RLS como camada de autoridade.

### 2.1. Estrutura de pastas

```
src/modules/billing/
├── actions/
│   ├── subscribe.ts               # cria/atualiza assinatura (checkout)
│   ├── change-plan.ts             # upgrade/downgrade
│   ├── cancel-subscription.ts     # cancela ao fim do período
│   ├── add-seat.ts                # adiciona usuário extra
│   └── apply-coupon.ts
├── queries/
│   ├── get-current-subscription.ts
│   ├── get-plan-catalog.ts
│   ├── get-usage.ts               # consumo atual do período
│   └── get-invoices.ts
├── components/
│   ├── pricing-table.tsx          # vitrine pública (4 tiers)
│   ├── plan-card.tsx              # card isolado e reutilizável
│   ├── usage-meter.tsx            # barra com limite/consumo
│   ├── upgrade-cta.tsx            # CTA contextual quando perto do limite
│   ├── plan-gate.tsx              # <PlanGate feature="multi_warehouse">…
│   └── billing-portal-link.tsx
├── services/
│   ├── subscription-service.ts    # lógica pura de transição de plano
│   ├── usage-service.ts           # cálculo de uso e overages
│   ├── feature-gate.ts            # canUseFeature(orgId, key)
│   └── price-calculator.ts        # seats + overages + desconto
├── schemas/
│   ├── subscription.ts
│   └── checkout.ts
├── types/
│   └── index.ts                   # derivado de Database['public']['Tables']
└── index.ts                       # barrel público
```

**Regra:** todo consumo externo importa por `@/modules/billing`, nunca `@/modules/billing/services/...` (regra já validada pelo ESLint do projeto).

### 2.2. Modelo de dados (migrations Supabase)

Arquivo sugerido: `supabase/migrations/20260424_01_billing.sql`.

```sql
-- Catálogo de planos (seed-controlled)
create table public.plans (
  id            text primary key,              -- 'free','starter','pro','business','enterprise'
  name          text not null,
  price_cents   integer not null,              -- preço mensal em centavos (BRL)
  annual_cents  integer,                       -- preço anual em centavos
  seats_included integer not null default 1,
  extra_seat_cents integer,                    -- preço do seat adicional
  product_limit integer,                       -- null = ilimitado
  movement_limit integer,                      -- null = ilimitado
  features      jsonb not null default '{}'::jsonb,
  is_active     boolean not null default true,
  sort_order    integer not null default 0
);

-- Assinaturas por organização
create type public.subscription_status as enum
  ('trialing','active','past_due','canceled','paused');

create table public.subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations(id) on delete cascade,
  plan_id             text not null references public.plans(id),
  status              public.subscription_status not null default 'trialing',
  billing_cycle       text not null check (billing_cycle in ('monthly','annual')),
  seats               integer not null default 1,
  current_period_start timestamptz not null,
  current_period_end   timestamptz not null,
  trial_end           timestamptz,
  cancel_at_period_end boolean not null default false,
  external_provider   text,                    -- 'stripe','iugu','asaas'
  external_id         text,                    -- id da subscription no provider
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (org_id)                              -- 1 subscription ativa por org
);

-- Contadores de uso (reset por período)
create table public.usage_counters (
  org_id      uuid not null references public.organizations(id) on delete cascade,
  metric      text not null,                   -- 'movements','products','api_calls'
  period_start date not null,
  value       bigint not null default 0,
  primary key (org_id, metric, period_start)
);

-- Histórico de faturas (espelho do provider)
create table public.invoices (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  amount_cents  integer not null,
  status        text not null,                 -- 'open','paid','failed'
  external_id   text,
  issued_at     timestamptz not null default now(),
  paid_at       timestamptz
);
```

**Triggers e funções:**

```sql
-- Helper: plano atual da org logada (use em RLS e queries)
create or replace function public.current_org_plan()
returns text language sql stable security definer as $$
  select s.plan_id
  from public.subscriptions s
  join public.profiles p on p.org_id = s.org_id
  where p.id = auth.uid() and s.status in ('trialing','active')
  limit 1;
$$;

-- Trigger no stock_movements: incrementa contador de uso por período
create or replace function public.increment_movement_usage()
returns trigger language plpgsql security definer as $$
declare
  v_period date := date_trunc('month', now())::date;
begin
  insert into public.usage_counters (org_id, metric, period_start, value)
  values (new.org_id, 'movements', v_period, 1)
  on conflict (org_id, metric, period_start)
    do update set value = usage_counters.value + 1;
  return new;
end;
$$;

create trigger trg_increment_movement_usage
  after insert on public.stock_movements
  for each row execute function public.increment_movement_usage();
```

### 2.3. RLS (autorização por tenant e por plano)

```sql
alter table public.subscriptions enable row level security;
alter table public.usage_counters enable row level security;
alter table public.invoices enable row level security;

-- Leitura restrita à própria org
create policy "subs_read_own_org" on public.subscriptions
  for select using (
    org_id = (select org_id from public.profiles where id = auth.uid())
  );

-- Apenas admin pode escrever (UI chama via Server Action; webhook do provider usa service_role)
create policy "subs_write_admin" on public.subscriptions
  for all using (
    org_id = (select org_id from public.profiles where id = auth.uid())
    and public.current_user_role() = 'admin'
  );
```

**Gate de features no banco (defesa em profundidade):**

```sql
-- Bloqueia insert de produto se exceder limite do plano
create or replace function public.enforce_product_limit()
returns trigger language plpgsql as $$
declare
  v_limit integer;
  v_count integer;
begin
  select p.product_limit into v_limit
  from public.plans p
  join public.subscriptions s on s.plan_id = p.id
  where s.org_id = new.org_id and s.status in ('trialing','active');

  if v_limit is null then return new; end if;

  select count(*) into v_count from public.products where org_id = new.org_id;
  if v_count >= v_limit then
    raise exception 'Limite de produtos do plano atingido. Faça upgrade para continuar.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger trg_enforce_product_limit
  before insert on public.products
  for each row execute function public.enforce_product_limit();
```

### 2.4. Serviços (TS puro, testável)

`src/modules/billing/services/feature-gate.ts`:

```ts
import "server-only";
import type { FeatureKey, PlanId } from "../types";

const MATRIX: Record<PlanId, ReadonlySet<FeatureKey>> = {
  free: new Set(["basic_reports"]),
  starter: new Set(["basic_reports", "roles"]),
  pro: new Set(["basic_reports", "roles", "multi_warehouse", "audit_log", "api_basic"]),
  business: new Set([
    "basic_reports",
    "roles",
    "multi_warehouse",
    "audit_log",
    "api_full",
    "sso",
    "bi_reports",
    "nfe",
  ]),
  enterprise: new Set(["*"]),
};

export function canUseFeature(plan: PlanId, feature: FeatureKey): boolean {
  const set = MATRIX[plan];
  return set.has("*" as FeatureKey) || set.has(feature);
}
```

`src/modules/billing/services/price-calculator.ts`:

```ts
import "server-only";
import type { Plan, BillingCycle } from "../types";

const ANNUAL_DISCOUNT = 0.17;

export function calculateTotal(args: {
  plan: Plan;
  cycle: BillingCycle;
  extraSeats: number;
  movementOverage: number;
}): { subtotal: number; discount: number; total: number } {
  const base =
    args.cycle === "annual"
      ? (args.plan.annual_cents ?? args.plan.price_cents * 12)
      : args.plan.price_cents;

  const seats = args.extraSeats * (args.plan.extra_seat_cents ?? 0);
  const overage = args.movementOverage * 2; // R$ 0,02 por movimentação extra

  const subtotal = base + seats + overage;
  const discount =
    args.cycle === "annual" ? Math.round(args.plan.price_cents * 12 * ANNUAL_DISCOUNT) : 0;

  return { subtotal, discount, total: subtotal - discount };
}
```

### 2.5. Server Actions (contrato `ActionResult`)

`src/modules/billing/actions/change-plan.ts`:

```ts
"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/modules/auth";
import { createServerClient } from "@/lib/supabase/server";
import { changePlanSchema } from "../schemas/subscription";
import type { ActionResult } from "@/lib/errors";

export async function changePlan(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Não autenticado." };

  const parsed = changePlanSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("change_subscription_plan", {
    p_plan_id: parsed.data.planId,
    p_cycle: parsed.data.cycle,
  });

  if (error) return { ok: false, message: error.message };
  revalidatePath("/billing");
  return { ok: true, message: "Plano atualizado." };
}
```

### 2.6. Componentes (componentização + reuso)

- **`<PricingTable />`** — recebe array de `Plan` e renderiza `<PlanCard />` para cada. Usada na landing pública e dentro do app.
- **`<PlanCard variant="current" | "recommended" | "default" />`** — card isolado com preço, features e CTA.
- **`<UsageMeter metric="movements" />`** — barra de progresso que vira amarela a 80% e vermelha a 95%, com link para upgrade.
- **`<PlanGate feature="multi_warehouse" fallback={<UpgradeCTA />}>`** — HOC server-side para esconder/bloquear features por plano.
- **`<UpgradeCTA context="movements_limit" />`** — CTA contextual, copy dinâmica de acordo com o motivo.

### 2.7. Provider de pagamento

Para pt-BR, recomendo priorizar **Iugu** ou **Asaas** (PIX + boleto + cartão, NF-e integrada). Stripe como segunda opção se o foco for internacional. Abstraia atrás de uma interface:

```ts
// src/modules/billing/services/payment-provider.ts
export interface PaymentProvider {
  createCheckout(args: CheckoutArgs): Promise<{ url: string }>;
  cancelSubscription(externalId: string): Promise<void>;
  handleWebhook(payload: unknown, signature: string): Promise<WebhookEvent>;
}
```

Implementações concretas (`IuguProvider`, `StripeProvider`) ficam intercambiáveis. Webhook chega em `app/api/billing/webhook/route.ts` e usa `service_role` para atualizar `subscriptions` sem esbarrar em RLS.

### 2.8. Integração com módulos existentes

- **`modules/inventory`**: adicionar chamada a `assertWithinPlan('products' | 'movements', orgId)` nos serviços antes de `validateMovement`. O gate de banco (trigger) é a rede de segurança.
- **`modules/auth`**: ao criar usuário via convite, chamar `assertWithinPlan('seats', orgId)`; se exceder, oferecer compra de seat extra.
- **`core/navigation/menu.ts`**: adicionar entrada `{ id: 'billing', label: 'Planos e cobrança', roles: ['admin'] }`.

### 2.9. Roadmap de implementação (sprints)

1. **Sprint 1** — Migrations (`plans`, `subscriptions`, `usage_counters`, `invoices`), seed do catálogo, RLS básico, regeneração de `database.types.ts`.
2. **Sprint 2** — Módulo `billing` com `feature-gate`, `price-calculator`, queries e action stub (sem provider ainda). `<PricingTable />` pública.
3. **Sprint 3** — Integração com provider (Iugu/Stripe), webhook, checkout real, `<UsageMeter />` e gating nos módulos existentes.
4. **Sprint 4** — Enterprise flow (orçamento manual), painel admin interno de métricas (MRR, churn, ARPU), testes E2E.

---

## Parte 3 — KPIs que você deve acompanhar

| Métrica                             | Meta inicial           | Como medir                                   |
| ----------------------------------- | ---------------------- | -------------------------------------------- |
| **MRR** (Monthly Recurring Revenue) | Crescimento 10–15%/mês | Soma de `subscriptions.price` ativas         |
| **ARPU** (Average Revenue per User) | ≥ R$ 180 após mês 6    | MRR / nº de orgs pagantes                    |
| **Churn mensal**                    | < 5%                   | Orgs canceladas / ativas no início do mês    |
| **Conversão Free → Pago**           | 3–5%                   | Orgs pagantes / Orgs criadas no Free         |
| **Net Revenue Retention**           | > 100%                 | (MRR final + expansão − churn) / MRR inicial |
| **Payback CAC**                     | < 12 meses             | CAC / (ARPU × margem)                        |

---

## Resumo executivo

1. **Comece enxuto**: Free + Starter + Pro nos primeiros 3 meses. Não tente lançar 5 tiers de uma vez.
2. **Modelo híbrido**: flat por plano + seats + overages — cobre os três modelos que você listou sem conflito.
3. **Implemente `billing` como módulo isolado** no padrão do projeto (barrel, ActionResult, Zod, RLS).
4. **Gate em duas camadas**: `feature-gate.ts` na UI/UX + triggers no Postgres como autoridade.
5. **Meça MRR, churn e conversão Free→Pago** desde o dia 1.
