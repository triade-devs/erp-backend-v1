# Fluxos de Auditoria

## Módulo: `audit`

Auditoria registra automaticamente eventos de todas as ações relevantes do ERP. **Não há ações de escrita por parte do usuário** — apenas leitura.

---

## Rotas

| Rota                   | Acesso             | Permission            |
| ---------------------- | ------------------ | --------------------- |
| `/[companySlug]/audit` | Usuário da empresa | `core:audit:read`     |
| `/admin/audit`         | Platform admin     | `platform_admin` flag |

---

## Auditoria por empresa

### Rota: `/[companySlug]/audit`

**Permissão:** `core:audit:read`

**Filtros disponíveis:**
| Filtro | Tipo | Descrição |
|--------|------|-----------|
| `userId` | uuid | Filtrar por usuário |
| `action` | string | Tipo de evento (ex: `product.created`) |
| `resource` | string | Recurso afetado |
| `dateFrom` | date | Data inicial |
| `dateTo` | date | Data final |

**Query:** `list-audit-logs.ts` — filtra por `company_id` via RLS

---

## Auditoria global (Platform Admin)

### Rota: `/admin/audit`

**Acesso:** somente `platform_admin` (verificado em `layout.tsx` do grupo `/admin`)

**Filtros adicionais:**

- `companyId` — filtrar por empresa específica

**Query:** `list-audit-logs-global.ts` — sem filtro de company (acesso total)

---

## Eventos registrados automaticamente

Eventos são inseridos em `audit_logs` pelas Server Actions via um helper de auditoria. Exemplos de eventos:

| Evento                | Quando                       |
| --------------------- | ---------------------------- |
| `product.created`     | Produto criado               |
| `product.updated`     | Produto editado              |
| `product.deactivated` | Produto desativado           |
| `movement.registered` | Movimentação registrada      |
| `member.invited`      | Convite enviado              |
| `member.role_changed` | Role do membro alterada      |
| `company.updated`     | Dados da empresa atualizados |

---

## Arquivos relevantes

```
src/modules/audit/
  queries/
    list-audit-logs.ts         ← auditoria por empresa
    list-audit-logs-global.ts  ← auditoria global (platform admin)
  components/
    audit-log-table.tsx

src/app/(dashboard)/
  [companySlug]/audit/page.tsx
  admin/audit/page.tsx
```
