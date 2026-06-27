import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { HttpAdapterHost, Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { SKIP_TENANT_KEY } from '../decorators/skip-tenant.decorator.js';

/** Token de metadata injetado pelo decorator @TenantProtected() (via UseGuards). */
const GUARDS_METADATA_KEY = '__guards__';

/**
 * Checagem de boot para rotas "órfãs".
 *
 * Toda rota da API deve ter exatamente uma classificação:
 *   - @Public()           → acessível sem autenticação
 *   - @SkipTenant()       → autenticada, sem tenant resolvido (onboarding)
 *   - @TenantProtected()  → autenticada + tenant resolvido (negócio)
 *
 * Rota sem nenhuma dessas marcações é um bug de segurança silencioso.
 *
 * Comportamento:
 *   - Em desenvolvimento: warning no log (não impede o boot).
 *   - Em CI/produção (NODE_ENV !== 'development'): lança erro e impede o boot.
 *
 * Decisão #8 do plano consolidado.
 */
@Injectable()
export class RouteClassificationChecker implements OnApplicationBootstrap {
  private readonly logger = new Logger(RouteClassificationChecker.name);

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly reflector: Reflector,
  ) {}

  onApplicationBootstrap(): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const server = this.httpAdapterHost?.httpAdapter?.getInstance?.();
    if (!server) {
      this.logger.warn('RouteClassificationChecker: httpAdapter não disponível, checagem ignorada.');
      return;
    }

    // O NestJS/Express expõe as rotas via _router.stack — acesso necessário via `any`
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const router = server._router;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!router?.stack) {
      this.logger.warn('RouteClassificationChecker: router.stack não disponível, checagem ignorada.');
      return;
    }

    const orphans: string[] = [];

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    for (const layer of router.stack as unknown[]) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const anyLayer = layer as any;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (!anyLayer.route) continue;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const route = anyLayer.route as { path?: string; stack: unknown[] };
      const path: string = route.path ?? '';

      if (!path || path.startsWith('/_')) continue;

      for (const handler of route.stack) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const anyHandler = handler as any;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-function-type
        const fn: Function | undefined = anyHandler.handle as Function | undefined;
        if (!fn) continue;

        const isPublic = this.reflector.get<boolean>(IS_PUBLIC_KEY, fn);
        const skipTenant = this.reflector.get<boolean>(SKIP_TENANT_KEY, fn);

        const guards = this.reflector.get<unknown[]>(GUARDS_METADATA_KEY, fn);
        const isTenantProtected = Array.isArray(guards) && guards.length > 0;

        const hasClassification = isPublic || skipTenant || isTenantProtected;

        if (!hasClassification) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          orphans.push(`${(anyHandler.method as string | undefined)?.toUpperCase?.() ?? '?'} ${path}`);
        }
      }
    }

    if (orphans.length === 0) {
      this.logger.log('✓ Todas as rotas possuem classificação de segurança.');
      return;
    }

    const message =
      `⚠️  ${orphans.length} rota(s) sem classificação de segurança (@Public, @SkipTenant ou @TenantProtected):\n` +
      orphans.map(r => `  • ${r}`).join('\n');

    const isProd = process.env.NODE_ENV !== 'development';
    if (isProd) {
      throw new Error(`[BOOT ERROR] ${message}`);
    } else {
      this.logger.warn(message);
    }
  }
}