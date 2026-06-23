# Mapeamento de Fluxos — ERP Modular

Índice de todos os fluxos da aplicação. Para detalhes completos (campos, validações, edge cases), consulte os arquivos em `docs/flows/`:

| Módulo                          | Arquivo de detalhe                                        |
| ------------------------------- | --------------------------------------------------------- |
| Autenticação                    | [`docs/flows/auth.md`](flows/auth.md)                     |
| Estoque (Inventory + Movements) | [`docs/flows/inventory.md`](flows/inventory.md)           |
| Base de Conhecimento            | [`docs/flows/knowledge-base.md`](flows/knowledge-base.md) |
| Empresa / Tenancy               | [`docs/flows/tenancy.md`](flows/tenancy.md)               |
| Administração (Platform Admin)  | [`docs/flows/admin.md`](flows/admin.md)                   |
| Auditoria                       | [`docs/flows/audit.md`](flows/audit.md)                   |

---

## Perfis de usuário

| Perfil             | Escopo                                                                |
| ------------------ | --------------------------------------------------------------------- |
| **Platform Admin** | Tudo (wildcard `*`) + rotas `/admin/*`                                |
| **Owner**          | Empresa completa (produtos, movimentações, auditoria, config, manual) |
| **Manager**        | Operações, sem configurações da empresa                               |
| **Operator**       | Operações básicas (movimentações)                                     |

---

## 1. Autenticação (público)

### Login `/login`

- Campos: `email`, `password` (mín. 8 chars)
- Sucesso → redireciona para `/`
- Links: "Esqueci a senha" → `/recover` · "Criar conta" → `/register`

### Cadastro `/register`

- Requer **token de convite** (URL `?t=...`)
- Campos: `inviteToken`, `fullName` (mín. 3), `password`, `confirmPassword`
- Sucesso → redireciona para `/{slug}/inventory`

### Recuperar senha `/recover`

- Campo: `email`
- Mensagem genérica (anti-enumeração) · cria log de auditoria

### Redefinir senha `/recover/reset?t=...`

- Token via URL · Campos: `password`, `confirmPassword`
- Sucesso → redireciona para `/login`

---

## 2. Dashboard `/`

### O que aparece

- KPI: **Produtos ativos**, **Estoque baixo**, **Valor em estoque**
- Lista dos 5 produtos com estoque mais crítico (SKU, nome, estoque atual, mínimo)
- CTAs: "Ver estoque" · "Registrar movimentação"

---

## 3. Estoque — Produtos `/{slug}/inventory`

### Listagem

- **Filtros:** busca por nome/SKU (`q`), toggle "Exibir inativos"
- **Ordenação:** clique nas colunas (SKU, Nome, Unidade, Estoque, Custo, Venda, Status)
- **Paginação:** pageSize configurável

### Criar produto `/{slug}/inventory/new`

> Permissão: `inventory:product:create`

| Campo          | Regra                                   |
| -------------- | --------------------------------------- |
| SKU            | obrigatório, máx 32, alfanumérico/hífen |
| Nome           | mín 2, máx 120                          |
| Descrição      | máx 2000                                |
| Unidade        | `UN` / `KG` / `L` / `CX` / `M`          |
| Custo          | número ≥ 0                              |
| Preço de venda | número ≥ 0                              |
| Estoque mínimo | número ≥ 0                              |
| Ativo          | boolean (padrão: sim)                   |

### Editar produto `/{slug}/inventory/{id}`

> Permissão: `inventory:product:update`

- Mesmos campos do cadastro

### Desativar / Reativar produto

> Permissão: `inventory:product:delete`

- Soft delete: `is_active = false`
- Produto pode ser **reativado** depois (mesma permissão)

---

## 4. Estoque — Movimentações `/{slug}/inventory/movements`

### Listagem

> Permissão: `movements:movement:read`

- Colunas: Data, Produto, Tipo, Quantidade, Custo unitário, Motivo
- **Filtros:** por produto, ordenação, paginação

### Registrar movimentação

> Permissão: `movements:movement:create`

| Campo          | Regra                                                  |
| -------------- | ------------------------------------------------------ |
| Produto        | UUID obrigatório (select)                              |
| Tipo           | `in` (Entrada) / `out` (Saída) / `adjustment` (Ajuste) |
| Quantidade     | > 0                                                    |
| Custo unitário | ≥ 0, opcional                                          |
| Motivo         | máx 500, opcional                                      |

> ⚠️ Saída com estoque insuficiente → bloqueada pelo banco (trigger `trg_apply_stock_movement`)

---

## 5. Manual / Base de Conhecimento `/{slug}/manual`

### Leitura

> Permissão: `kb:article:read`

- Sidebar com árvore de categorias
- Lista de artigos por categoria

### Gestão de artigos `/{slug}/manual/editor`

> Permissão: `kb:article:write`

| Campo              | Regra                                  |
| ------------------ | -------------------------------------- |
| Título             | 2..200 chars                           |
| Resumo             | máx 500                                |
| Conteúdo           | editor TipTap (Markdown) — obrigatório |
| Categoria          | UUID, opcional                         |
| Público-alvo       | `user` / `dev` / `both`                |
| Módulo relacionado | opcional                               |
| Tabela relacionada | opcional                               |

- Ações: **Criar** · **Editar** artigo existente

---

## 6. Auditoria `/{slug}/audit`

> Permissão: `core:audit:read`

- Exibe log de eventos da empresa (ações do sistema, quem fez o quê)

---

## 7. Configurações da empresa `/{slug}/settings/general`

> Permissão: `core:company:update`

| Campo            | Regra               |
| ---------------- | ------------------- |
| Nome da empresa  | mín 2               |
| Documento (CNPJ) | opcional            |
| Slug             | **somente leitura** |
| Plano            | **somente leitura** |

- Salvar → gera log de auditoria `company.update`

---

## 8. Admin — Empresas `/admin/companies`

> Apenas Platform Admin

### Listagem

- Colunas: Nome, Slug, Plano, Status, Data de criação
- Ações por linha: editar empresa

### Criar empresa `/admin/companies/new`

| Campo         | Regra                             |
| ------------- | --------------------------------- |
| Nome          | obrigatório                       |
| Slug          | obrigatório                       |
| Plano         | obrigatório                       |
| Documento     | opcional                          |
| Módulos       | seleção dos módulos habilitados   |
| Email do dono | obrigatório (cria o membro owner) |

### Detalhe da empresa `/admin/companies/{id}`

- Editar dados da empresa
- Gerenciar **membros**
- Gerenciar **módulos habilitados**

---

## 9. Admin — Roles `/admin/platform/roles`

> Apenas Platform Admin

- Lista roles do sistema: `owner`, `manager`, `operator`
- Lista todas as roles de todas as empresas
- **Matriz de permissões:** ligar/desligar permission codes por role

---

## 10. Admin — Módulos `/admin/platform/modules`

> Apenas Platform Admin

- Listar módulos da plataforma com estatísticas de uso por empresa
- Criar · Editar · Ativar/Desativar · Excluir módulo

---

## 11. Admin — Auditoria Global `/admin/audit`

> Apenas Platform Admin

- **Filtros:** empresa, ação, status (`success` / `denied` / `error`)
- Exibe até 500 logs mais recentes de todas as empresas

---

## 12. Company Switcher (sidebar)

- Visível para usuários com **mais de uma empresa**
- Ao trocar: valida membership ativa → grava cookies `ACTIVE_COMPANY` e `ACTIVE_COMPANY_SLUG` → navega para o novo slug

---

## Mapa de permissões

| Código                      | Operação                      |
| --------------------------- | ----------------------------- |
| `inventory:product:create`  | Criar produto                 |
| `inventory:product:update`  | Editar produto                |
| `inventory:product:delete`  | Desativar / reativar produto  |
| `inventory:product:read`    | Listar produtos               |
| `movements:movement:create` | Registrar movimentação        |
| `movements:movement:read`   | Ver movimentações             |
| `kb:article:read`           | Ler artigos do manual         |
| `kb:article:write`          | Criar / editar artigos        |
| `core:company:update`       | Editar dados da empresa       |
| `core:audit:read`           | Ver auditoria da empresa      |
| `*` (wildcard)              | Platform Admin — acesso total |
