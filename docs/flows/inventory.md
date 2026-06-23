# Fluxos de Estoque (Inventory + Movements)

## Dois módulos separados

O estoque é dividido em dois módulos com permission codes distintos:

| Módulo      | Código                 | O que controla              |
| ----------- | ---------------------- | --------------------------- |
| `inventory` | `inventory:product:*`  | CRUD de produtos            |
| `movements` | `movements:movement:*` | Registro de entradas/saídas |

---

## Produtos

### Rota

`/[companySlug]/inventory`

### Permissões necessárias

| Operação  | Permission code            |
| --------- | -------------------------- |
| Listar    | `inventory:product:read`   |
| Criar     | `inventory:product:create` |
| Editar    | `inventory:product:update` |
| Desativar | `inventory:product:delete` |
| Reativar  | `inventory:product:update` |

### Criar produto

**Campos e validação** (`schemas/product-schema.ts`):
| Campo | Tipo | Regra |
|-------|------|-------|
| `name` | string | mínimo 2 caracteres |
| `sku` | string | único na empresa |
| `unit` | string | ex: `un`, `kg`, `cx` |
| `costPrice` | number | ≥ 0 |
| `salePrice` | number | ≥ 0 |
| `minStock` | number | ≥ 0 |
| `categoryId` | uuid? | opcional |

**Fluxo:**

1. `createProductAction` → `requirePermission(companyId, 'inventory:product:create')`
2. Parse Zod → `safeParse`; retorna `fieldErrors` se inválido
3. Insert em `products` com `company_id` da empresa ativa
4. `revalidatePath("/")`

### Editar produto

**Campos:** mesmos do cadastro (sem `sku` — não editável após criação)

**Ação:** `updateProductAction` → `requirePermission(companyId, 'inventory:product:update')`

### Desativar / Reativar produto

- **Desativar:** `deactivateProductAction` → `inventory:product:delete` — soft delete, seta `deleted_at`
- **Reativar:** `reactivateProductAction` → `inventory:product:update` — limpa `deleted_at`

---

## Movimentações

### Rota

`/[companySlug]/inventory` (mesma página — tab ou modal separado)

### Permissões necessárias

| Operação  | Permission code             |
| --------- | --------------------------- |
| Listar    | `movements:movement:read`   |
| Registrar | `movements:movement:create` |

### Registrar movimentação

**Campos e validação** (`schemas/movement-schema.ts`):
| Campo | Tipo | Regra |
|-------|------|-------|
| `productId` | uuid | produto ativo da empresa |
| `type` | enum | `"in"` \| `"out"` \| `"adjustment"` |
| `quantity` | number | > 0 |
| `unitCost` | number? | opcional (para entradas) |
| `reason` | string? | opcional |

**Fluxo com dupla validação:**

```
registrarMovimentação
  ↓
1. requirePermission('movements:movement:create')
  ↓
2. Pré-validação TS: validateMovement() em stock-service.ts
   └─ type=out && quantity > product.stock → throw "Estoque insuficiente para o produto: <id>"
   └─ (retorna { ok: false, message } imediatamente — sem hit no banco)
  ↓
3. INSERT stock_movements
  ↓
4. Trigger trg_apply_stock_movement (Postgres):
   └─ Atualiza products.stock
   └─ Se saída && stock < 0 → raise exception 'Estoque insuficiente...'
   └─ (capturado como error.message.includes("Estoque insuficiente"))
  ↓
5. revalidatePath("/")
```

> ⚠️ **Nunca escreva diretamente em `products.stock`**. O trigger é a fonte de verdade.
