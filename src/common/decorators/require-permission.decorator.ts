import { SetMetadata } from '@nestjs/common';

/**
 * Chave de metadata usada pelo PermissionGuard para ler os codes exigidos.
 * Exportada para uso no guard e nos testes.
 */
export const REQUIRE_PERMISSION_KEY = 'require_permission';

/**
 * @RequirePermission(...codes) — Exige que o usuário possua pelo menos um
 * dos permission codes listados (semântica OR).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Pré-condições
 * ─────────────────────────────────────────────────────────────────────────
 * Deve ser usado JUNTO com @TenantProtected() (no controller ou no método),
 * pois depende de `request.tenant.permissions` já estar montado pelo TenantGuard.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Semântica: OR (padrão deliberado)
 * ─────────────────────────────────────────────────────────────────────────
 * O request é autorizado se o usuário possuir **qualquer um** dos codes
 * listados. Isso permite que múltiplos roles acessem o mesmo endpoint:
 *
 *   @RequirePermission('inventory:product:read')   → só quem pode ler
 *   @RequirePermission('inventory:product:create') → só quem pode criar
 *   @RequirePermission(
 *     'inventory:movement:create',
 *     'inventory:movement:cancel',
 *   )  → quem pode criar OU cancelar (ex: endpoint usado pelos dois roles)
 *
 * Se a rota não carregar este decorator, o PermissionGuard passa sem checar
 * (permite granularidade apenas onde necessário).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Uso no controller
 * ─────────────────────────────────────────────────────────────────────────
 * @example
 * ```ts
 * @TenantProtected()
 * @Controller('products')
 * export class ProductsController {
 *
 *   @Get()
 *   @RequirePermission('inventory:product:read')
 *   list() { ... }
 *
 *   @Post()
 *   @RequirePermission('inventory:product:create')
 *   create() { ... }
 *
 *   @Delete(':id')
 *   @RequirePermission('inventory:product:delete')
 *   remove() { ... }
 * }
 * ```
 */
export const RequirePermission = (...codes: [string, ...string[]]) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, codes);
