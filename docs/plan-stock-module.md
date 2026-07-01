## Plano — Módulo de Estoque (v1 consolidado)
Baseado em tudo que foi revisado: schema v3, guards implementados, permission codes confirmados do banco, contrato dos 4 microserviços de enrichment, spec canônica FIFO. Este documento é o plano completo — nenhuma decisão aberta da fase de Auth interfere aqui.

## Estrutura de módulos NestJS

Os `module_code` do banco (`inventory`, `movements`, `suppliers`) ditam os 3 módulos de negócio. Mais um módulo interno sem rotas próprias:

```
src/
  enrichment/              ← cliente HTTP interno, sem rotas públicas
  suppliers/               ← module_code: suppliers
  inventory/               ← module_code: inventory
    classifications/       ← subdomínio: árvore de categorias
    products/              ← subdomínio: CRUD de produtos
    change-requests/       ← subdomínio: fila de câmera
  movements/               ← module_code: movements
    stock-movements/       ← endpoints públicos
    stock-layers/          ← service interno, sem rotas
```

---

## Fase 1 — `EnrichmentModule` (cliente HTTP interno)

Pré-requisito de Suppliers e Inventory (ambos chamam o enrichment). Sem rotas públicas — é um módulo de infraestrutura consumido pelos módulos de negócio.

**4 variáveis de ambiente** (uma por microserviço):
```
ENRICHMENT_NCM_URL
ENRICHMENT_EMPRESA_URL
ENRICHMENT_CEP_URL
ENRICHMENT_BARCODE_URL
```

**Contrato de resiliência** aplicado igualmente nos 4 clientes: timeout 2500ms, fallback retorna `null` silenciosamente (nunca lança exceção — o controller trata `null` como "enriquecimento indisponível, usuário preenche manualmente"). Esse é o padrão da spec original e continua valendo mesmo sem auth por enquanto.

**`EnrichmentService`** expõe 4 métodos com assinaturas baseadas nos tipos já definidos no `@enrichment/shared`:
- `lookupEmpresa(cnpj: string): Promise<EmpresaResponse | null>`
- `lookupCep(cep: string): Promise<CepResponse | null>`
- `lookupBarcode(ean: string): Promise<BarcodeResponse | null>`
- `lookupNcm(q: string): Promise<NcmResult[]>` (retorna `[]` no fallback)

**Observação registrada, não bloqueante**: `isActive` no `EmpresaResponse` está sempre `false` por bug no `ms-empresa` (comparação com campo errado — `situacao_cadastral` número vs string `"ATIVA"`). O NestJS não vai usar esse campo para nenhuma decisão de negócio nesta entrega — é dado exibido no form de autopreenchimento, não validado. Bug a corrigir no repo do `enrichment-services` quando houver janela.

---

## Fase 2 — `SuppliersModule`

CRUD simples, mas o primeiro a usar o `EnrichmentModule`.

**Endpoints e permissions:**

| Endpoint | Permission |
|---|---|
| `GET /suppliers` | `suppliers:supplier:read` |
| `GET /suppliers/:id` | `suppliers:supplier:read` |
| `POST /suppliers` | `suppliers:supplier:create` |
| `PATCH /suppliers/:id` | `suppliers:supplier:update` |
| `DELETE /suppliers/:id` | `suppliers:supplier:delete` |

**`DELETE` é soft-delete** — `is_active: false`. Não existe exclusão física: fornecedor está referenciado em `stock_layers` (FK), deletar fisicamente quebraria o histórico de lotes.

**Endpoint auxiliar de enriquecimento** (sem permission própria — usa `suppliers:supplier:create` ou `update`):
`GET /suppliers/enrich/cnpj/:cnpj` → chama `EnrichmentService.lookupEmpresa()`, retorna o DTO de autopreenchimento ou `{}` em caso de falha. O front usa isso pra preencher o form antes do POST — nunca persiste diretamente.

**Ponto de atenção na query**: todo `findMany` de fornecedores filtra `company_id: tenant.companyId` — nunca lista fornecedores de outras empresas. Isso vai ser repetido em todo módulo; é o mecanismo de isolamento de tenant enquanto não existe RLS real no Postgres (decisão mantida da fase de Auth).

---

## Fase 3 — `ProductClassificationsModule` (dentro de `InventoryModule`)

Árvore de 3 níveis. **Sem trigger no banco** (confirmado) — validação de hierarquia em código, no service, antes de qualquer insert.

**Regras de hierarquia validadas em código:**

| `level` | `parent_id` | Regra |
|---|---|---|
| `department` | `null` | Raiz — sem pai |
| `category` | obrigatório | Pai deve existir, ser da mesma empresa, ter `level: 'department'` |
| `brand` | obrigatório | Pai deve existir, ser da mesma empresa, ter `level: 'category'` |

Violação → `BadRequestException` com mensagem descritiva antes de tocar no banco.

**Endpoints:**

| Endpoint | Permission |
|---|---|
| `GET /inventory/classifications` | `inventory:product:read` |
| `POST /inventory/classifications` | `inventory:product:create` |
| `PATCH /inventory/classifications/:id` | `inventory:product:update` |
| `DELETE /inventory/classifications/:id` | `inventory:product:update` |

`DELETE` aqui é exclusão física **com guarda**: só executa se não existir nenhum produto com `classification_id` apontando para o nó (ou seus filhos). Se existir, `BadRequestException` — a hierarquia de categorias é dado de referência, não pode desaparecer silenciosamente de baixo dos produtos.

---

## Fase 4 — `ProductsModule` (dentro de `InventoryModule`)

**Endpoints e permissions:**

| Endpoint | Permission |
|---|---|
| `GET /inventory/products` | `inventory:product:read` |
| `GET /inventory/products/:id` | `inventory:product:read` |
| `POST /inventory/products` | `inventory:product:create` |
| `PATCH /inventory/products/:id` | `inventory:product:update` |
| `PATCH /inventory/products/:id/deactivate` | `inventory:product:delete` |
| `PATCH /inventory/products/:id/reactivate` | `inventory:product:update` |

**Contrato explícito do `POST /inventory/products`**:
- `stock` não é campo do DTO de criação — nasce `0` pelo default do schema.
- `cost_price` não existe no schema — não entra no DTO.
- `classification_id` é opcional — quando presente, valida que o nó existe e pertence à mesma empresa (sem validar o `level` aqui — qualquer nível da árvore é válido como classificação de produto, conforme spec).

**Efeito colateral em `PATCH` quando `sale_price` muda**: dentro da mesma transação do update, insere linha em `sale_price_history` com `price: novoValor`, `valid_from: now()`, `changed_by: tenant.membershipId` (ou o `user.id` — decidir qual faz mais sentido pra auditoria; recomendo `user.id` porque `membershipId` é relacional a uma empresa específica, e o histórico de preço é do produto).

**Endpoint auxiliar de enriquecimento:**
`GET /inventory/products/enrich/barcode/:ean` → `EnrichmentService.lookupBarcode()`. Sem permission própria.
`GET /inventory/products/enrich/ncm?q=` → `EnrichmentService.lookupNcm()`. Para autocomplete do campo NCM.

---

## Fase 5 — Motor FIFO (núcleo do sistema)

Esta é a fase mais crítica. Um erro de implementação aqui não é detectável pela UI — aparece só quando alguém faz conciliação financeira e os números não batem.

### `StockLayersService` (interno, sem rotas)

Dois métodos usados pelos outros services — nunca expostos diretamente:

**`createLayer(tx, data)`**: cria um `stock_layers` dentro de uma transação. Sempre chamado por `StockMovementsService` nos tipos `in` e `adjustment`. Nunca chamado diretamente por controller.

**`consumeStock(tx, companyId, productId, qtyNeeded, movementId)`**: implementação fiel à spec canônica:
1. `SELECT ... FOR UPDATE` ordenado por `entry_date ASC` — trava pessimista.
2. Loop de abatimento: para cada lote, calcula `deductFromThisLayer = min(layer.quantity_remaining, remainingToDeduct)`.
3. `UPDATE stock_layers SET quantity_remaining -= deductFromThisLayer`.
4. `INSERT movement_layer_consumption` com a fatia exata.
5. Se ao final `remainingToDeduct > 0` → `BadRequestException('Furo de integridade: Saldo físico menor que a requisição transacional')`.

**Sem timeout de lock no MVP.** Revisitar se houver contention real em produção.

**Proibição explícita documentada no service**: nunca fazer `UPDATE products SET stock = X` diretamente. O campo `products.stock` é atualizado pelo trigger do banco (`trg_apply_stock_movement`). Mas espera — você me disse que não tem trigger. Preciso entender isso antes de você codar esta fase.

**Bloqueio real na Fase 5**: se não existe trigger atualizando `products.stock`, quem atualiza? A spec original diz "Saldo por gatilho" e "Nunca mexer no saldo na mão." Mas você disse que não lembra de ter criado trigger. Rodar isso antes de começar a Fase 5:

```sql
select trigger_name, event_manipulation, action_statement
from information_schema.triggers
where event_object_table = 'products';
```

Se vier vazio: o `StockMovementsService` precisa atualizar `products.stock` explicitamente dentro da transação, incrementando em `in`/`adjustment` e decrementando em `out`/`loss`. Se existir trigger: nunca tocar em `products.stock` no código — o banco cuida. Isso muda o código da Fase 5 inteiramente, então precisa ser confirmado antes.

### `StockMovementsService` (endpoints públicos)

**`POST /movements`** — único endpoint para os 4 tipos. Branch interno:

| `movement_type` | Lógica | `unit_cost` | `reason` |
|---|---|---|---|
| `in` | `createLayer()` | **obrigatório** | opcional |
| `adjustment` | `createLayer()` (sempre positivo) | **obrigatório** | opcional |
| `out` | `consumeStock()` | ignorado | opcional |
| `loss` | `consumeStock()` | ignorado | **obrigatório** |

Toda a operação (criar movement + criar/atualizar layer + consumption records + atualizar stock se não houver trigger) roda em `prisma.$transaction()`. Se qualquer passo falhar, nada persiste.

**`GET /movements`** — listagem com filtro por `productId`, `movement_type`, range de datas. Paginação.

**`GET /movements/:id`** — detalhe, incluindo `movement_layer_consumption` (de quais lotes saiu, a que custo).

| Endpoint | Permission |
|---|---|
| `GET /movements` | `movements:movement:read` |
| `GET /movements/:id` | `movements:movement:read` |
| `POST /movements` | `movements:movement:create` |

`movements:movement:cancel` — **não implementado nesta entrega**, conforme decisão registrada no início do plano.

---

## Fase 6 — Fila de Câmera (`ChangeRequestsModule`, dentro de `InventoryModule`)

**Fluxo completo:**
1. Operador (sem `inventory:product:create`) lê EAN pela câmera.
2. Front chama `GET /inventory/products/enrich/barcode/:ean` — se o produto já existe, retorna o produto. Se não existe, retorna o DTO do enrichment para pré-preencher a request.
3. Operador submete `POST /inventory/change-requests` — cria registro com `status: 'pending'`.
4. Gerente lista `GET /inventory/change-requests?status=pending`.
5. Gerente aprova: `POST /inventory/change-requests/:id/approve` — transação ACID:
   - Cria `products`.
   - Cria `stock_movements` tipo `in` (primeira entrada).
   - Chama `createLayer()` com `unit_cost` do DTO de aprovação.
   - Atualiza `stock_change_requests.status = 'confirmed'`, `resolved_by`, `resolved_at`.

| Endpoint | Permission |
|---|---|
| `POST /inventory/change-requests` | `movements:movement:create` (operador que não tem `inventory:product:create` — usa o de movimentação como proxy de intenção) |
| `GET /inventory/change-requests` | `inventory:product:read` |
| `POST /inventory/change-requests/:id/approve` | `inventory:product:create` |
| `POST /inventory/change-requests/:id/reject` | `inventory:product:create` |

**Decisão sobre permission do `POST /change-requests`**: operador usa `movements:movement:create` porque é o que ele tem no template `estoque-operacao`. Faz sentido semântico: ele está registrando uma intenção de movimentação, não criando um produto.

---

## Ordem de execução

```
Fase 1 (Enrichment client)
  ↓
Fase 2 (Suppliers) ──── pode ser paralela com Fase 3
Fase 3 (Classifications)
  ↓
Fase 4 (Products)
  ↓
[confirmar trigger de products.stock]
  ↓
Fase 5 (Motor FIFO)
  ↓
Fase 6 (Fila de Câmera)
```

---

## Única pendência que bloqueia código

**Antes de começar a Fase 5**: resultado da query dos triggers em `products`. Tudo até a Fase 4 pode ser codado agora.

```sql
select trigger_name, event_manipulation, action_statement
from information_schema.triggers
where event_object_table = 'products';
```

Manda o resultado e eu fecho o contrato exato do `StockMovementsService`.