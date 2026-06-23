# Playbook de Onboarding de Cliente

> **Objetivo:** Provisionar uma nova empresa cliente no ERP em menos de 5 minutos.
> **Audiência:** Administradores da plataforma (equipe interna)
> **Última atualização:** 2026-04-24

---

## Índice

1. [Pré-requisitos](#pré-requisitos)
2. [Passo 1: Criar a Empresa](#passo-1-criar-a-empresa)
3. [Passo 2: Verificar Bootstrap das Roles](#passo-2-verificar-bootstrap-das-roles)
4. [Passo 3: Owner Aceita o Convite](#passo-3-owner-aceita-o-convite)
5. [Passo 4: Verificar Acesso](#passo-4-verificar-acesso)
6. [Troubleshooting](#troubleshooting)
7. [Referência Rápida](#referência-rápida)

---

## Pré-requisitos

Antes de começar, verifique se você tem:

- **Acesso ao painel administrativo** — você deve estar logado com uma conta que tem `is_platform_admin = true`
- **Email do Owner** — o endereço de email da pessoa que será proprietária da empresa (ex: proprietario@empresa.com)
- **Informações da empresa:**
  - Nome da empresa (ex: "Acme Corporation")
  - Slug único (ex: "acme") — usado na URL (ex: app.erp.com/acme/...)
  - Plano a contratar: `starter`, `pro`, ou `enterprise`
  - Módulos a habilitar (ex: `inventory`, `movements`)

---

## Passo 1: Criar a Empresa

### 1.1 Acessar o formulário de nova empresa

1. Faça login no painel administrativo
2. Navegue para `/admin/companies/new`
3. Você verá um assistente com 3 etapas

### 1.2 Etapa 1 — Informações Básicas

Preencha:

- **Nome da empresa:** ex: "Acme Corporation" (campo obrigatório)
- **Slug:** ex: "acme" (campo obrigatório)
  - Deve ser único entre todas as empresas já criadas
  - Apenas letras minúsculas, hífens e números (sem espaços)
  - Será usado em URLs como `/acme/inventory`
- **CNPJ/Documento** (opcional): ex: "12.345.678/0001-90"
- **Plano:** selecione `starter`, `pro`, ou `enterprise`

Clique em **"Próximo"** para continuar.

### 1.3 Etapa 2 — Habilitar Módulos

Marque os módulos que o cliente deseja usar:

| Módulo        | Descrição                                         |
| ------------- | ------------------------------------------------- |
| **inventory** | Gestão de produtos, SKUs, preços, estoques        |
| **movements** | Registro de entradas, saídas e ajustes de estoque |

Cada módulo habilitado criará entradas em `company_modules` e as roles padrão receberão as permissões correspondentes. Você pode adicionar mais módulos depois se necessário.

Clique em **"Próximo"** para continuar.

### 1.4 Etapa 3 — Convidar o Owner

Preencha:

- **Email do Owner:** ex: "proprietario@empresa.com" (campo obrigatório)

O sistema enviará um email de convite para esse endereço. O Owner clicará no link para aceitar e definir sua senha.

Clique em **"Criar Empresa"** para finalizar.

### 1.5 Confirmação

Você verá uma mensagem de sucesso:

```
✓ Empresa "Acme Corporation" criada com sucesso!
```

Neste momento, o sistema:

- Criou a empresa em `companies`
- Habilitou os módulos escolhidos em `company_modules`
- Executou `bootstrap_company_rbac('company-id')` no banco, criando as três roles padrão: **owner**, **manager**, **operator**
- Criou uma membership com status `invited` para o email do Owner
- Enviou um email de convite via Supabase Auth

---

## Passo 2: Verificar Bootstrap das Roles

Após criar a empresa, valide que o bootstrap das roles funcionou corretamente. Você pode verificar de duas maneiras:

### Opção A: Supabase Studio (recomendado para debug rápido)

1. Acesse [Supabase Dashboard](https://app.supabase.com) e selecione seu projeto
2. Navegue para **SQL Editor** → **Database**
3. Execute a query abaixo, substituindo `{company-id}` pelo ID da empresa criada:

```sql
-- Listar roles criadas para a empresa
select r.id, r.code, r.name, r.is_system, count(rp.permission_code) as permission_count
from public.roles r
left join public.role_permissions rp on rp.role_id = r.id
where r.company_id = '{company-id}'
group by r.id, r.code, r.name, r.is_system
order by r.code;
```

**Resultado esperado:** Deve retornar 3 linhas:

| code     | name     | permission_count |
| -------- | -------- | ---------------- |
| owner    | Owner    | 2+               |
| manager  | Manager  | 2+               |
| operator | Operator | 1+               |

Para ver as permissões de cada role:

```sql
-- Listar permissões por role
select r.code, rp.permission_code
from public.roles r
join public.role_permissions rp on rp.role_id = r.id
where r.company_id = '{company-id}'
order by r.code, rp.permission_code;
```

### Opção B: Audit Log (via painel, se implementado)

1. Acesse o painel de auditoria da empresa criada
2. Procure por eventos com action = `"company.create"`
3. Verifique se o `status` é `"success"`

**Nota:** Se o bootstrap falhar, a membership será criada mas as roles não. O Owner receberá o email mas não conseguirá acessar a empresa.

---

## Passo 3: Owner Aceita o Convite

O Owner receberá um email de convite similar a este:

```
De: noreply@auth.supabase.io
Assunto: Você foi convidado para Acme Corporation

Clique no link abaixo para aceitar o convite e definir sua senha:
[https://app.erp.com/accept-invite?c=company-id&token=...]

Esse link expira em 24 horas.
```

### 3.1 Owner clica no link

O Owner abre o email no navegador e clica no link de convite.

### 3.2 Aceitar e definir senha

O Owner é redirecionado para `/accept-invite?c=<companyId>&token=<token>` onde:

1. Confirma a aceitação do convite
2. Define uma senha
3. Clica em "Confirmar"

### 3.3 Membership ativada

Após confirmar, o sistema:

- Atualiza a membership de status `invited` → `active`
- Owner pode agora fazer login e acessar a empresa
- Vê `/[companySlug]/` (ex: `/acme/`) como home do dashboard

### 3.4 Confirmação de sucesso

O Owner é redirecionado para o dashboard da empresa. Se vir o menu com os módulos habilitados, tudo funcionou!

**Nota:** Se a membership permanece `invited` após o Owner confirmar, há um bug no fluxo de aceitação — verifique os logs da aplicação.

---

## Passo 4: Verificar Acesso

### 4.1 Owner consegue fazer login?

1. Vá para a página de login: [https://app.erp.com/login](https://app.erp.com/login)
2. Digite o email do Owner
3. Digite a senha que definiu
4. Deve ser redirecionado para `/acme/` (ou o slug da empresa)

### 4.2 Owner vê os módulos corretos?

Após fazer login, o Owner deve ver no menu lateral (esquerda) apenas os módulos que você habilitou na Etapa 2.

**Exemplo:** Se habilitou "inventory" e "movements", verá:

```
Home
├── Estoque
│   ├── Produtos
│   └── Movimentações
├── Configurações
│   └── Membros
└── Sair
```

### 4.3 Owner consegue criar um teste?

Para módulo **inventory**:

1. Vá para `Estoque → Produtos`
2. Clique em `Novo Produto`
3. Preencha: nome, SKU, preço
4. Clique em `Salvar`

Se conseguir criar um produto, as permissões estão funcionando. ✓

### 4.4 Timing de sucesso

O provisioning está completo quando:

- [ ] Empresa existe em `companies`
- [ ] Módulos foram habilitados em `company_modules`
- [ ] Roles padrão existem em `roles` (owner, manager, operator)
- [ ] Owner recebeu o email de convite
- [ ] Owner fez login com sucesso
- [ ] Owner consegue acessar e usar um recurso de um módulo habilitado

**Tempo total esperado:** < 5 minutos (excluindo delay no email)

---

## Troubleshooting

### Email de convite não chega

**Sintomas:** Owner não recebe o email de convite

**Passos de debug:**

1. Verifique se o email foi digitado corretamente na Etapa 3
2. Verifique spam/filtros do cliente
3. No Supabase Studio, vá para **Auth → Users** e procure pelo email
   - Se não aparecer: o convite não foi enviado
   - Se aparece com status `invited`: o convite foi enviado; pode ser que chegue em breve
4. Para reenviar o convite:
   - Vá para Supabase Dashboard → **SQL Editor**
   - Execute: (exemplo para Supabase Auth resend — varie conforme sua integração)

   ```sql
   -- Marcar membership como re-invitável (se houver coluna)
   -- Ou simplesmente criar uma nova membership se a anterior expirou
   ```

   - Ou: delete a membership antiga e crie uma nova via painel

### Owner aceita convite mas não consegue fazer login

**Sintomas:** Owner clica no link, confirma, vê mensagem de sucesso, mas depois não consegue logar

**Passos de debug:**

1. No Supabase Studio, verifique **Auth → Users**:
   - O usuário existe?
   - Status é `Confirmed`?
2. Verifique a membership em **SQL Editor**:

   ```sql
   select id, user_id, company_id, status, joined_at
   from public.memberships
   where user_id = 'user-id' and company_id = 'company-id';
   ```

   - Status deve ser `active`
   - `joined_at` deve ter um timestamp recente

3. Se status é `invited`:
   - O handler de aceitação de convite pode ter falhado
   - Verifique os logs da aplicação (Vercel → Deployments → Logs)
4. Se nada funciona:
   - Delete a membership antiga
   - Recrie enviando um novo convite

### Owner faz login mas não vê nenhum módulo

**Sintomas:** Owner consegue logar, vê a página inicial vazia ou com erro

**Passos de debug:**

1. Verifique se os módulos foram habilitados:

   ```sql
   select module_code, enabled_at
   from public.company_modules
   where company_id = 'company-id';
   ```

   - Deve retornar 2+ linhas (ou conforme configurado)

2. Verifique se a role do Owner tem permissões:

   ```sql
   select r.code, count(rp.permission_code) as permission_count
   from public.roles r
   left join public.role_permissions rp on rp.role_id = r.id
   where r.company_id = 'company-id' and r.code = 'owner'
   group by r.code;
   ```

   - Deve retornar `permission_count` > 0

3. Verifique se a membership tem uma role atribuída:

   ```sql
   select mr.membership_id, mr.role_id, r.code
   from public.membership_roles mr
   join public.roles r on r.id = mr.role_id
   join public.memberships m on m.id = mr.membership_id
   where m.user_id = 'owner-user-id' and m.company_id = 'company-id';
   ```

   - Deve retornar pelo menos 1 linha com `code = 'owner'`

### Bootstrap das roles não ocorreu (criação falhou)

**Sintomas:** Empresa foi criada mas as roles não existem; Owner recebe email mas ao logar não consegue fazer nada

**Passos de debug:**

1. Verifique se a função existe no banco:
   ```sql
   select 1 from information_schema.routines
   where routine_name = 'bootstrap_company_rbac';
   ```
2. Verifique se há erros na execução:
   - Logs da aplicação (Vercel)
   - Logs do Supabase (Dashboard → Logs)
3. Para recuperar:
   - Execute manualmente no SQL Editor:

   ```sql
   select public.bootstrap_company_rbac('company-id');
   ```

   - Se retorna sucesso: roles foram criadas, tudo ok
   - Se retorna erro: há um problema no schema do banco (entre em contato com o dev)

### Empresa criada mas com slug inválido

**Sintomas:** Slug foi criado com espaços, maiúsculas ou caracteres especiais

**Passos de recuperação:**

1. Não há forma de corrigir após criação (slug é PK)
2. Delete a empresa (cuidado: isso deleta todos os dados)
   ```sql
   delete from public.companies where id = 'company-id';
   ```
3. Recrie com o slug correto

---

## Referência Rápida

### Queries úteis para verificação

**Listar todas as empresas criadas:**

```sql
select id, name, slug, plan, is_active, created_at
from public.companies
order by created_at desc
limit 20;
```

**Listar membros de uma empresa:**

```sql
select m.id, m.user_id, p.full_name, m.status, m.joined_at
from public.memberships m
left join public.profiles p on p.id = m.user_id
where m.company_id = '{company-id}'
order by m.created_at;
```

**Listar permissões de um usuário em uma empresa:**

```sql
select distinct rp.permission_code
from public.memberships m
join public.membership_roles mr on mr.membership_id = m.id
join public.roles r on r.id = mr.role_id
join public.role_permissions rp on rp.role_id = r.id
where m.user_id = '{user-id}' and m.company_id = '{company-id}' and m.status = 'active'
order by rp.permission_code;
```

### Estatísticas do sistema

**Contar empresas por plano:**

```sql
select plan, count(*) as total
from public.companies
where is_active = true
group by plan
order by plan;
```

**Contar membros ativos por empresa:**

```sql
select c.name, count(m.id) as active_members
from public.companies c
left join public.memberships m on m.company_id = c.id and m.status = 'active'
where c.is_active = true
group by c.id, c.name
order by c.created_at desc;
```

### Tabela de Roles Padrão

| Role         | Código     | Descrição                                                                                          |
| ------------ | ---------- | -------------------------------------------------------------------------------------------------- |
| **Owner**    | `owner`    | Acesso total a todos os módulos habilitados + permissões de plataforma (convidar membros, auditar) |
| **Manager**  | `manager`  | Acesso CRUD nos recursos dos módulos + leitura de auditoria + permissão para convidar membros      |
| **Operator** | `operator` | Acesso leitura + criação nos recursos dos módulos (sem edição/exclusão de terceiros)               |

### Permissões Padrão por Módulo

Após `bootstrap_company_rbac()`, cada role recebe permissões conforme o módulo:

**Módulo: inventory**

- `inventory:product:create` — criar produtos
- `inventory:product:read` — listar/visualizar produtos
- `inventory:product:update` — editar produtos
- `inventory:product:delete` — deletar produtos

**Módulo: movements**

- `movements:movement:create` — registrar movimentação
- `movements:movement:read` — listar movimentações

**Permissões de core (todos os roles)**

- `core:audit:read` — acessar log de auditoria
- `core:member:invite` — convidar membros (owner + manager)

---

## Contato e Suporte

Se algo não funciona conforme esperado:

1. Verifique o [Troubleshooting](#troubleshooting) acima
2. Consulte os logs da aplicação:
   - [Vercel Deployments](https://vercel.com) → seu projeto → Deployments → Logs
   - [Supabase Dashboard](https://app.supabase.com) → Logs
3. Abra uma issue no repositório do projeto com os detalhes e as queries SQL que executou
