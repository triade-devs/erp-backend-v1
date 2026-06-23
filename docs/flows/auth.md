# Fluxos de Autenticação

Rotas públicas — não requerem sessão.

## Rotas

| Rota                       | Componente                | Ação                    |
| -------------------------- | ------------------------- | ----------------------- |
| `/login`                   | `sign-in-form.tsx`        | `signInAction`          |
| `/register`                | `sign-up-form.tsx`        | `signUpAction`          |
| `/recover`                 | `recover-form.tsx`        | `recoverPasswordAction` |
| `/recover/reset?t=<token>` | `reset-password-form.tsx` | `resetPasswordAction`   |

---

## Login

**Campos e validação** (`schemas/index.ts:3-6`):
| Campo | Regra |
|-------|-------|
| `email` | e-mail válido |
| `password` | mínimo 8 caracteres |

**Fluxo:**

1. `signInAction` → Supabase `signInWithPassword`
2. Sucesso → `redirect("/")`
3. Layout `(dashboard)` verifica membership ativa → se ausente → `redirect("/sem-acesso")`

**Comportamento adicional:**

- Usuário já autenticado acessando `/login` → middleware redireciona para `/`
- `?redirect=<path>` no middleware **não é consumido** pelo `signInAction` — o redirect pós-login é sempre `/`

---

## Cadastro

**Requer token de convite** via URL `?t=<token>` — sem token, não é possível criar conta.

**Campos e validação** (`schemas/index.ts:8-18`):
| Campo | Regra |
|-------|-------|
| `inviteToken` | obrigatório |
| `fullName` | mínimo 3 caracteres |
| `password` | mínimo 8 caracteres |
| `confirmPassword` | deve ser igual a `password` |

**Fluxo:**

1. `signUpAction` → valida token de convite no banco
2. Cria usuário no Supabase Auth
3. Vincula ao `invitation` e cria membership na empresa
4. Sucesso → `redirect("/${companySlug}/inventory")`

---

## Recuperar senha

**Campo:** `email` (válido)

**Fluxo:**

1. `recoverPasswordAction` → Supabase `resetPasswordForEmail`
2. Cria log de auditoria (anti-enumeração — mesma mensagem mesmo se e-mail não existir)
3. Não redireciona — exibe mensagem de sucesso inline

---

## Redefinir senha

**Token via URL** `?t=<token>` — prefillado no campo oculto.

**Campos e validação** (`schemas/index.ts:24-33`):
| Campo | Regra |
|-------|-------|
| `tokenOrShortCode` | obrigatório (do URL) |
| `password` | mínimo 8 caracteres |
| `confirmPassword` | deve ser igual a `password` |

**Fluxo:**

1. `resetPasswordAction` → valida token, atualiza senha
2. Sucesso → `redirect("/login")`

---

## Arquivos relevantes

```
src/
  app/(auth)/
    login/page.tsx
    register/page.tsx
    recover/page.tsx
    recover/reset/page.tsx
  modules/auth/
    actions/sign-in.ts
    actions/sign-up.ts
    actions/recover-password.ts
    actions/reset-password.ts
    components/sign-in-form.tsx
    components/sign-up-form.tsx
    components/recover-form.tsx
    components/reset-password-form.tsx
    schemas/index.ts
  middleware.ts
  app/api/auth/callback/route.ts
```
