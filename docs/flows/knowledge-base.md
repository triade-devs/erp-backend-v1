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

---

## Arquivos relevantes

```
src/modules/knowledge-base/
  actions/
    create-article.ts
    update-article.ts
    publish-article.ts
    delete-article.ts
  queries/
    list-articles.ts
    get-article.ts
  components/
    article-editor.tsx   ← TipTap
    article-list.tsx

supabase/migrations/
  20260425000021_kb_permissions.sql   ← permissões e habilitação por empresa
  20260425000020_kb_rls.sql           ← RLS de artigos
```
