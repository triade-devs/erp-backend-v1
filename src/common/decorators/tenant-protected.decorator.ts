import { applyDecorators, UseGuards } from '@nestjs/common';
import { SupportAccessGuard } from '../guards/support-access.guard.js';
import { TenantGuard } from '../guards/tenant.guard.js';
import { CompanyActiveGuard } from '../guards/company-active.guard.js';

/**
 * Decorator composto `@TenantProtected()`.
 *
 * Aplica a pilha completa de guards de tenant, em ordem fixa e inviolável:
 *   SupportAccessGuard → TenantGuard → CompanyActiveGuard
 *
 * Uso obrigatório em todos os controllers de negócio que acessam dados de empresa.
 * Garante um único ponto de aplicação em vez de 3 guards manuais espalhados,
 * eliminando o risco de "guard esquecido silenciosamente".
 *
 * @example
 * ```ts
 * @TenantProtected()
 * @Controller('products')
 * export class ProductsController { ... }
 * ```
 */
export const TenantProtected = () =>
  applyDecorators(
    UseGuards(
      SupportAccessGuard, // 1º: detecta modo suporte e enriquece request.user
      TenantGuard, // 2º: resolve companyId, membership, permissões
      CompanyActiveGuard, // 3º: valida setup_status da empresa
    ),
  );