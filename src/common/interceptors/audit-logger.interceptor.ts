import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser, TenantContext } from '../interfaces/request-context.interface.js';

/**
 * Interceptor de Audit Log.
 *
 * Registra automaticamente todas as operações mutantes (POST, PUT, PATCH, DELETE)
 * na tabela `audit_logs`. Operações GET são ignoradas por padrão para não
 * poluir o log de auditoria.
 *
 * Captura:
 * - Quem fez (actor_user_id, actor_email)
 * - Em qual empresa (company_id)
 * - O que fez (action = METHOD /path)
 * - IP e User-Agent
 * - Se foi via suporte (metadata.isSupportProxy)
 *
 * NOTA: Este interceptor opera em best-effort — falhas de escrita no audit_log
 * NÃO devem impedir a operação principal. Por isso, erros são apenas logados.
 */
@Injectable()
export class AuditLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLoggerInterceptor.name);

  private static readonly AUDITABLE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser; tenant?: TenantContext }>();

    // Audita métodos mutantes sempre.
    // Audita GET/HEAD apenas quando o request vem de operador de suporte (Fase G).
    const isMutant = AuditLoggerInterceptor.AUDITABLE_METHODS.has(request.method);
    const isSupportRead = request.method === 'GET' && request.user?.isSupportProxy === true;

    if (!isMutant && !isSupportRead) {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.writeAuditLog(request, 'success', startTime).catch(err =>
            this.logger.error('Falha ao escrever audit log', err),
          );
        },
        error: () => {
          this.writeAuditLog(request, 'error', startTime).catch(err =>
            this.logger.error('Falha ao escrever audit log', err),
          );
        },
      }),
    );
  }

  private async writeAuditLog(
    request: Request & { user?: AuthenticatedUser; tenant?: TenantContext },
    status: string,
    _startTime: number,
  ): Promise<void> {
    const user = request.user;
    const tenant = request.tenant;

    if (!user) return; // Rota pública, nada a logar

    await this.prisma.db.audit_logs.create({
      data: {
        company_id: tenant?.companyId ?? null,
        actor_user_id: user.id,
        actor_email: user.email,
        action: `${request.method} ${request.route?.path ?? request.url}`,
        resource_type: this.extractResourceType(request.url),
        status,
        ip: (request.ip ?? request.socket.remoteAddress) || null,
        user_agent: request.headers['user-agent'] ?? null,
        metadata: {
          ...(user.isSupportProxy && {
            isSupportProxy: true,
            realCompanyId: user.realCompanyId,
          }),
        },
      },
    });
  }

  /**
   * Extrai o tipo de recurso a partir da URL.
   * Ex: /api/v1/inventory/products/123 → "products"
   */
  private extractResourceType(url: string): string | null {
    const segments = url.split('/').filter(Boolean);
    // Pegar o penúltimo segmento se o último parecer um UUID, ou o último
    if (segments.length === 0) return null;

    const last = segments[segments.length - 1];
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(last);

    if (isUuid && segments.length >= 2) {
      return segments[segments.length - 2];
    }

    return last;
  }
}