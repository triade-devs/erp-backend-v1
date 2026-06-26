import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { TenantContext } from '../interfaces/request-context.interface.js';

/**
 * Decorator `@CurrentTenant()` para controllers.
 *
 * Extrai o TenantContext injetado pelo TenantGuard.
 *
 * @example
 * ```ts
 * @UseGuards(TenantGuard)
 * @Get('products')
 * listProducts(@CurrentTenant() tenant: TenantContext) {
 *   return this.productService.findAll(tenant.companyId);
 * }
 *
 * // Ou extrair apenas o companyId:
 * @Get('products')
 * listProducts(@CurrentTenant('companyId') companyId: string) {
 *   return this.productService.findAll(companyId);
 * }
 * ```
 */
export const CurrentTenant = createParamDecorator(
  (
    data: keyof TenantContext | undefined,
    ctx: ExecutionContext,
  ): TenantContext | TenantContext[keyof TenantContext] => {
    const request = ctx.switchToHttp().getRequest<Request & { tenant: TenantContext }>();
    const tenant = request.tenant;

    if (!tenant) {
      throw new Error('CurrentTenant decorator invocado sem TenantGuard ativo na rota.');
    }

    return data ? tenant[data] : tenant;
  },
);