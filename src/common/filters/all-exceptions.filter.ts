import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Filtro global de exceções.
 *
 * Responsabilidades:
 * 1. Normalizar TODAS as respostas de erro em formato consistente.
 * 2. Logar exceções inesperadas (não-HTTP) com stack trace completo.
 * 3. Nunca vazar detalhes internos em produção.
 *
 * Formato de resposta:
 * ```json
 * {
 *   "statusCode": 422,
 *   "error": "Unprocessable Entity",
 *   "message": "Detalhe legível para o frontend",
 *   "timestamp": "2025-01-01T00:00:00.000Z",
 *   "path": "/api/v1/inventory/products"
 * }
 * ```
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Erro interno do servidor';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp.message as string | string[]) ?? exception.message;
        error = (resp.error as string) ?? 'Error';
      }
    } else {
      // Exceções inesperadas — log completo, sem vazar pro client
      this.logger.error(
        `Exceção não tratada em ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
