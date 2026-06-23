# Fluxos de Tenancy (Empresa e Company Switcher)

## O que é Tenancy

Tenancy é o módulo que gerencia a relação entre o usuário autenticado e a(s) empresa(s) às quais pertence. Controla qual empresa está ativa e as operações de configuração da empresa.

---

## Company Switcher

### Onde fica

Menu lateral — seção superior do sidebar, acima da navegação.

### Fluxo de troca de empresa

1. Usuário clica no nome da empresa no sidebar
2. Lista de empresas com membership ativa é exibida
3. Seleção → `switchActiveCompanyAction(companyId)`
4. Salva `activeCompanyId` em cookie/sessão
5. `redirect("/${novoSlug}/inventory")` (ou página principal do módulo)

**Ação:** `switch-active-company.ts` — não requer permission especial (toda membership válida pode trocar)

---

## Configurações da empresa

### Rota: `/[companySlug]/settings`

### Permissões necessárias

| Operação          | Permission code                                               |
| ----------------- | ------------------------------------------------------------- |
| Ver configurações | `core:company:update` (implícito — quem pode editar pode ver) |
| Editar dados      | `core:company:update`                                         |

### Campos editáveis

| Campo     | Tipo    | Regra               |
| --------- | ------- | ------------------- |
| `name`    | string  | mínimo 3 caracteres |
| `slug`    | string  | único, sem espaços  |
| `logoUrl` | string? | URL válida          |
| `cnpj`    | string? | formato CNPJ        |
| `phone`   | string? | formato telefone    |
| `address` | string? | endereço livre      |

**Ação:** `updateCompanyAction` → `requirePermission(companyId, 'core:company:update')`

---

## Gerenciar membros

### Rota: `/[companySlug]/settings` → aba Membros

### Permissões

| Operação       | Permission code                                  |
| -------------- | ------------------------------------------------ |
| Convidar       | `core:member:invite` ou `core:invitation:create` |
| Ver membros    | `core:member:manage`                             |
| Alterar role   | `core:member:manage`                             |
| Remover membro | `core:member:manage`                             |

### Convidar membro

**Campos:**
| Campo | Tipo | Regra |
|-------|------|-------|
| `email` | string | e-mail válido |
| `roleId` | uuid | role da empresa |

**Fluxo:**

1. `createInvitationAction` → `requirePermission(companyId, 'core:invitation:create')`
2. Gera token de convite único
3. Retorna link com `?t=<token>` (sem envio de e-mail — SMTP-free)
4. Admin compartilha o link manualmente com o convidado

**Revogar convite:** `revokeInvitationAction` → `core:invitation:revoke`

**Aceitar convite:** `acceptInvitationAction` — público (não requer autenticação prévia), cria membership

---

## Reset de senha (SMTP-free)

### Fluxo

1. Usuário vai para `/recover` e pede reset
2. Gera `reset_request` com token no banco (sem envio de e-mail)
3. Admin aprova reset: `src/modules/tenancy/actions/` — permissão `core:reset_request:approve`
4. Admin compartilha link `/recover/reset?t=<token>` com o usuário
5. Usuário usa o link para definir nova senha

---

## Arquivos relevantes

```
src/modules/tenancy/
  actions/
    switch-active-company.ts
    update-company.ts
    create-invitation.ts
    accept-invitation.ts
    revoke-invitation.ts
    regenerate-invitation.ts
    update-member-roles.ts
    update-member-status.ts
    transfer-member.ts
  queries/
    get-current-user.ts
    list-companies.ts
    list-members.ts
    list-invitations.ts
  components/
    company-switcher.tsx
    company-settings-form.tsx
    members-table.tsx
    invite-form.tsx

src/app/(dashboard)/[companySlug]/settings/
  page.tsx
  members/page.tsx
```
