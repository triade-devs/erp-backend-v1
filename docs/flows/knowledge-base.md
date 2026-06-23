# Fluxos da Base de Conhecimento (Knowledge Base)

## Módulo: `knowledge-base`

### Rotas

| Rota                                  | Descrição             |
| ------------------------------------- | --------------------- |
| `/[companySlug]/manual`               | Lista de artigos      |
| `/[companySlug]/manual/[slug]`        | Visualizar artigo     |
| `/[companySlug]/manual/novo`          | Criar artigo (write)  |
| `/[companySlug]/manual/[slug]/editar` | Editar artigo (write) |

---

## Permissões

| Permission code      | O que permite                |
| -------------------- | ---------------------------- |
| `kb:article:read`    | Ver artigos publicados       |
| `kb:article:write`   | Criar e editar rascunhos     |
| `kb:article:publish` | Publicar/despublicar artigos |
| `kb:doc:read`        | Ver documentação técnica     |
| `kb:ai:use`          | Usar copiloto de IA          |

### Distribuição por role padrão

| Role       | Permissões                                 |
| ---------- | ------------------------------------------ |
| `owner`    | todas                                      |
| `manager`  | read + write + publish + doc:read + ai:use |
| `operator` | read + ai:use                              |

---

## Criar artigo

**Campos e validação** (`schemas/`):
| Campo | Tipo | Regra |
|-------|------|-------|
| `title` | string | mínimo 3 caracteres |
| `content` | string | editor TipTap (HTML) |
| `categoryId` | uuid? | categoria opcional |
| `slug` | string | gerado automaticamente do título |

**Fluxo:**

1. `createArticleAction` → `requirePermission(companyId, 'kb:article:write')`
2. Cria artigo com `status: 'draft'`
3. `revalidatePath("/[companySlug]/manual")`

---

## Publicar artigo

**Ação:** `publishArticleAction` → `requirePermission(companyId, 'kb:article:publish')`

**Fluxo:**

1. Verifica que artigo pertence à empresa
2. Alterna `status` entre `'draft'` ↔ `'published'`
3. `revalidatePath`

---

## Editar artigo

**Ação:** `updateArticleAction` → `requirePermission(companyId, 'kb:article:write')`

**Campos:** `title`, `content`, `categoryId` (slug não editável)

---

## Excluir artigo

**Ação:** `deleteArticleAction` → `requirePermission(companyId, 'kb:article:write')`

Soft delete — seta `deleted_at`.
