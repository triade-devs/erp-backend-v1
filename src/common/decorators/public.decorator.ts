import { SetMetadata } from '@nestjs/common';

/**
 * Chave de metadata usada pelo SupabaseAuthGuard para identificar rotas públicas.
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator `@Public()` para marcar rotas que não exigem autenticação.
 *
 * @example
 * ```ts
 * @Public()
 * @Get('health')
 * healthCheck() {
 *   return { status: 'ok' };
 * }
 * ```
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
