import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../interfaces/request-context.interface.js';

/**
 * Decorator `@CurrentUser()` para controllers.
 *
 * Extrai o payload do usuário autenticado que foi injetado
 * pelo `SupabaseAuthGuard` no objeto `request.user`.
 *
 * @example
 * ```ts
 * @Get('profile')
 * getProfile(@CurrentUser() user: AuthenticatedUser) {
 *   return this.profileService.findOne(user.id);
 * }
 *
 * // Ou extrair apenas um campo:
 * @Get('profile')
 * getProfile(@CurrentUser('id') userId: string) {
 *   return this.profileService.findOne(userId);
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (
    data: keyof AuthenticatedUser | undefined,
    ctx: ExecutionContext,
  ): AuthenticatedUser | AuthenticatedUser[keyof AuthenticatedUser] => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = (request as Request & { user: AuthenticatedUser }).user;

    if (!user) {
      throw new Error('CurrentUser decorator invocado sem SupabaseAuthGuard ativo na rota.');
    }

    return data ? user[data] : user;
  },
);