## Plano — Auth + Onboarding (e handoff para Estoque) — v2 (consolidado)

Baseado no que você já tem: `SupabaseAuthGuard` (HS256, global), `TenantGuard` (header `x-company-id`, **não** global), `CompanyActiveGuard` (no-op, **não** global), `PrismaService.db`/`.forTenant()` (placeholder), `AuditLoggerInterceptor` e `AllExceptionsFilter` (globais), `@Public()`. Todos os arquivos foram revisados. Todas as decisões abertas no plano anterior foram resolvidas. Este documento substitui o anterior por completo.

---

### Decisões — todas fechadas

| # | Decisão | Resolução |
|---|---|---|
| 1 | Guards manuais vs decorator composto | **Decorator composto** `@TenantProtected()` = `SupportAccessGuard → TenantGuard → CompanyActiveGuard`, ordem fixa |
| 2 | Status HTTP por status de empresa | **423** só `PENDING_FISCAL` (exceto rota `@AllowDuringFiscalSetup()`) · **403** para `PENDING_SEED` e `SUSPENDED` |
| 3 | Permissões do suporte em modo proxy | **Conjunto fixo** via constante `SUPPORT_PROXY_PERMISSIONS` no código — não acesso total |
| 4 | Header `x-company-id` durante suporte | **Obrigatório + validado** contra `grant.company_id` |
| 5 | MFA do support grant | **Caminho 3**: guard real atrás de flag `SUPPORT_MFA_ENFORCED` (default `false`), compensado por regra de "quatro olhos" + `reason` obrigatório/auditado + janela fixa de 15min |
| 6 | Seed de `role_templates` | **Confirmado** — catálogo já existe e é granular (`admin`, `estoque-gestao`, `estoque-operacao`, `estoque-leitura`, `kb-editor`, `espacos-*`) |
| 7 | Validação do token de convite | **`short_code` (lookup) + token secreto comparado contra `token_hash`** — nunca confiar só no `short_code` |
| 8 | Checagem de "rota órfã" no boot | **Sim** — warning em dev, erro em CI/produção |

---

### Fase A — Decorator composto `@TenantProtected()`

Combina, em ordem fixa: `SupportAccessGuard → TenantGuard → CompanyActiveGuard`. Resolve o risco estrutural exposto pelo `CompanyActiveGuard` no-op (guard "esquecido" silenciosamente) — um único ponto de aplicação por controller de negócio em vez de 3 guards manuais. Entra como `applyDecorators(UseGuards(...))`, com comentário documentando a pilha (mesmo padrão de documentação que você já usa no `app.module.ts`).

---

### Fase B — `CompanyActiveGuard` deixa de ser no-op

Pré-requisito: `TenantContext` ganha `setupStatus: CompanySetupStatus`.

1. `TenantGuard` passa a incluir `companies → setup_status` na mesma query de membership (FK já existe).
2. `CompanyActiveGuard` implementa a lógica real:
   - `ACTIVE` → libera.
   - `PENDING_FISCAL` → **423 Locked**, exceto rota marcada `@AllowDuringFiscalSetup()` (novo decorator, usado só pelo endpoint E2).
   - `PENDING_SEED` → **403 Forbidden** (defesa em profundidade — não deveria ter membership de terceiros nesse estado).
   - `SUSPENDED` → **403 Forbidden**.

---

### Fase C — `SupportAccessGuard` + ajustes de suporte no `TenantGuard`

**Pré-requisito novo, descoberto na revisão**: `AuthenticatedUser` precisa expor o claim `aal` (`'aal1' | 'aal2'`) que o Supabase já inclui no JWT. Sem isso a Fase F não tem o que checar. É um campo opcional na interface + uma linha no `verifyJwt()` do `SupabaseAuthGuard` que já decodifica o payload.

`SupportAccessGuard` (novo, `common/guards/support-access.guard.ts`):
1. Lê `X-Support-Grant`. Ausente → `canActivate` retorna `true` sem efeito (modo suporte é opcional).
2. Presente → busca `support_access_grants` por id, valida `expires_at > now()`. Inválido/expirado → `UnauthorizedException`.
3. Válido → sobrescreve `request.user` com `isSupportProxy: true`, `realCompanyId: grant.company_id`, mantendo `id` original do operador (autor real, para auditoria).

`TenantGuard` ganha um branch:
- Se `user.isSupportProxy === true`: pula o lookup de `memberships`. Monta `TenantContext` direto com `companyId: user.realCompanyId`.
- Valida que o header `x-company-id` enviado bate com `user.realCompanyId` — se não bater, `ForbiddenException` (decisão #4).
- `TenantContext.permissions` recebe o conteúdo fixo de `SUPPORT_PROXY_PERMISSIONS` (constante a definir — leitura ampla + um conjunto pequeno de ações de escrita, expandido sob demanda real, não aberto de antemão) em vez de ir buscar `role_permissions` (decisão #3).

---

### Fase D — Decorator `@SkipTenant()` + checagem de boot

`@SkipTenant()`: metadata simples, usada pelos controllers de onboarding (Fase E) para sinalizar "autenticado, mas roda sem tenant resolvido" — não tem lógica de guard própria, é documentação executável.

Checagem de boot (decisão #8): rotina em `onApplicationBootstrap` que varre todas as rotas registradas via `Reflector`/`HttpAdapterHost` e confirma que cada uma tem exatamente uma classificação: `@Public()`, `@SkipTenant()` ou `@TenantProtected()`. Rota sem nenhuma → warning em dev, erro de boot em CI/produção.

---

### Fase E — Onboarding (as 3 portas)

Módulo novo `src/onboarding/`. Todos os endpoints usam `@SkipTenant()`.

**E1 — `POST /companies`** (self-service)
Transação única:
1. Cria `companies` (`setup_status: PENDING_SEED`).
2. `seedSilentTenantEntities`: `company_settings` default + `product_classifications` raiz "GERAL".
3. Cria `memberships` do criador (`status: active`).
4. Resolve `role_templates` `code: 'admin'` (confirmado existente).
5. Cria `roles` da empresa a partir do template + `role_permissions` a partir de `template_permissions` + `membership_roles` ligando o criador.
6. `setup_status → PENDING_FISCAL`.

**E2 — `PATCH /companies/:id/fiscal-data`**
Usa `@AllowDuringFiscalSetup()` (Fase B). Atualiza dados fiscais (hoje só `companies.document` existe no schema — se precisar de mais campos, é migration nova, fora do escopo deste plano). `setup_status: PENDING_FISCAL → ACTIVE`.

**E3 — `POST /invitations/:shortCode/accept`** (cobre Portas 2 e 3)
- Busca convite por `short_code` (lookup key, não segredo).
- Compara hash do token recebido no body/link contra `token_hash` armazenado — `short_code` isolado nunca é suficiente (decisão #7).
- Valida `status: pending`, `expires_at > now()`.
- Cria `memberships` (`status: active`) + `membership_roles` a partir de `role_ids` do convite.
- Marca `accepted`, `accepted_by`, `accepted_at`.
- Sem complexidade extra de "múltiplas empresas simultâneas" — tenant é resolvido por header, não por sessão única (já confirmado).

---

### Fase F — Criação do Support Grant (Caminho 3 completo)

Pré-requisito novo: `PlatformAdminGuard` (não existe ainda) — lookup direto em `platform_admins` por `user.id`, sem relação com tenant.

`POST /platform/support-grants`:
1. `PlatformAdminGuard` barra quem não é admin de plataforma.
2. MFA condicional: se `SUPPORT_MFA_ENFORCED=true` (env, default `false`), exige `user.aal === 'aal2'` → senão `ForbiddenException`. Se a flag for `false`, passo pulado — mas os próximos passos valem **sempre**, flag ligada ou não.
3. `reason` obrigatório, com validação de tamanho mínimo no DTO (frase real, não texto decorativo).
4. Regra de quatro olhos: `support_user_id !== granted_by`, validada explicitamente no service (não é constraint de banco — é regra de processo). Violação → `BadRequestException`.
5. `expires_at = now() + 15min` calculado no servidor — nunca aceito do client, nem presente no DTO de entrada.
6. Cria o grant. Recomendo duplicar `reason` e `support_user_id` de forma visível no próprio registro/metadata (não só via FK), para facilitar auditoria/revisão posterior sem join.
7. Retorna `id` do grant para o client usar como `X-Support-Grant`.

Quando a conta Supabase certa tiver MFA configurado para `platform_admins`, virar `SUPPORT_MFA_ENFORCED=true` é a única mudança necessária — nenhum guard precisa ser reaberto.

---

### Fase G — Auditoria

Revisão concluída. Estrutura atual está correta (best-effort, não bloqueia resposta, resiliente a `tenant == null`). Dois pontos:

1. **Ajuste pendente, pequeno**: `AUDITABLE_METHODS` hoje ignora GET. A doc pede "tudo que o suporte faz vai para a auditoria" — leitura por operador de suporte é ação sensível. Ajuste: auditar GET também, mas **apenas quando `user.isSupportProxy === true`**. Não muda comportamento para tráfego normal.
2. **Dívida documentada, não bloqueante agora**: `metadata` não carrega "antes e depois" de mudanças de domínio — isso é estrutural (interceptor genérico não tem acesso a estado de domínio). Vira pauta da Fase de Estoque: vai precisar de um mecanismo (`AsyncLocalStorage`, decorator `@AuditDiff()`, ou `AuditService.attach()` chamado pelos services) para alimentar esse diff quando o motor FIFO existir.

---

### Catálogo de permissões (decisão extra, fechada por contexto)

Confirmado que o catálogo de `role_templates`/`permissions`/`modules` já existe e é granular e estável. **Não construir** um mecanismo de sincronização automática catálogo↔código (Opção B) agora — seria esforço adiantado sem dor correspondente. Revisitar só se o catálogo crescer rápido ou o drift entre código e banco começar a doer na prática.

---

### Ordem de execução

```
Fase A → Fase B → Fase D → Fase E → (Fase C + Fase F, em paralelo) → Fase G (ajuste item 1) → Estoque
```

Nenhuma decisão pendente bloqueando o início. Pré-requisitos novos identificados nesta revisão (campo `aal` na interface, `PlatformAdminGuard`) entram nas fases C/F onde são necessários, não antes.

### Depois disso → Estoque (FIFO)

Só inicia depois que A, B, D, E estiverem fechadas — o motor `consumeStock` roda dentro de rotas `@TenantProtected()` e depende de `request.tenant.companyId` resolvido e empresa `ACTIVE`. A dívida de auditoria (item 2 da Fase G) é retomada no design do módulo de Estoque, não antes.