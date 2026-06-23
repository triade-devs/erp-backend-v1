# Fluxos de Administração (Platform Admin)

## Acesso

Requer flag `platform_admin` na tabela `platform_admins`. Verificada em `src/app/(dashboard)/admin/layout.tsx`.

`platform_admin` **não é** uma membership de empresa — é uma flag global separada.

No TypeScript, `requirePermission()` retorna `Set(["*"])` para platform admins (bypassa verificação). No Postgres, `has_permission()` **não conhece** platform admins — depende das políticas RLS específicas de admin.

---

## Rotas

| Rota                          | Descrição                          |
| ----------------------------- | ---------------------------------- |
| `/admin`                      | Dashboard de plataforma            |
| `/admin/companies`            | Gerenciar todas as empresas        |
| `/admin/companies/[id]`       | Detalhes de uma empresa            |
| `/admin/platform`             | Roles, permissões, módulos globais |
| `/admin/platform/roles`       | Roles do sistema                   |
| `/admin/platform/permissions` | Permissões do sistema              |
| `/admin/platform/modules`     | Módulos do sistema                 |
| `/admin/audit`                | Auditoria global                   |

---

## Gerenciar empresas

### Criar empresa

**Campos:**
| Campo | Tipo | Regra |
|-------|------|-------|
| `name` | string | mínimo 3 caracteres |
| `slug` | string | único, sem espaços |

**Ação:** `createCompanyAction` — somente platform admin

**Fluxo:**

1. Cria registro em `companies`
2. Cria roles padrão (`owner`, `manager`, `operator`) para a empresa
3. Habilita módulos padrão (`inventory`, `movements`) via `company_modules`

### Gerenciar membros de empresa

**Ação:** `addMemberToCompanyAction` — adiciona usuário existente a uma empresa

**Ação:** `searchUsersForCompanyAction` — busca usuários por e-mail

### Habilitar/desabilitar módulos por empresa

**Ação:** `toggleModuleAction` → habilita/desabilita `company_modules`
**Ação:** `bulkToggleModuleForCompaniesAction` → em massa

---

## Gerenciar módulos globais

### Criar módulo

**Campos:** `code`, `name`, `is_system`, `sort_order`

**Ação:** `createModuleAction` — somente platform admin

### Editar / Excluir módulo

**Ações:** `updateModuleAction`, `deleteModuleAction`

> Módulos `is_system: true` não podem ser excluídos.

---

## Gerenciar roles

### Criar role

**Campos:**
| Campo | Tipo | Regra |
|-------|------|-------|
| `name` | string | nome da role |
| `code` | string | identificador único (`owner`, `manager`, `operator`) |
| `companyId` | uuid | empresa dona da role |

**Ação:** `createRoleAction`

### Atualizar permissões de uma role

**Ação:** `updateRolePermissionsAction` — define o conjunto de `permission_codes` da role
**Ação:** `updateSystemRolePermissionsAction` — para roles do sistema

---

## Gerenciar permissões

**Ações:** `createPermissionAction`, `deletePermissionAction`

Permissões são associadas a um `module_code` e definem `resource:action`.
