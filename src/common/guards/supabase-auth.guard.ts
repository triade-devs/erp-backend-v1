import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { createHmac } from 'node:crypto';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import type { AuthenticatedUser } from '../interfaces/request-context.interface.js';
import type { EnvConfig } from '../config/env.validation.js';

/**
 * Guard global de autenticação via Supabase JWT (HS256).
 *
 * Fluxo:
 * 1. Verifica se a rota está marcada com @Public() — se sim, libera.
 * 2. Extrai o Bearer token do header Authorization.
 * 3. Decodifica e verifica a assinatura HMAC-SHA256 usando SUPABASE_JWT_SECRET.
 * 4. Valida expiração (exp).
 * 5. Injeta o payload tipado em `request.user`.
 *
 * NOTA: Usamos verificação manual (sem dependência de jsonwebtoken)
 * para manter o bundle leve. O Supabase Auth sempre emite HS256.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(SupabaseAuthGuard.name);
  private readonly jwtSecret: string;

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService<EnvConfig>,
  ) {
    this.jwtSecret = this.configService.getOrThrow('SUPABASE_JWT_SECRET');
  }

  canActivate(context: ExecutionContext): boolean {
    // ── 1. Rota pública? ──
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // ── 2. Extrair token ──
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autenticação ausente');
    }

    const token = authHeader.slice(7);

    // ── 3. Decodificar e verificar ──
    const payload = this.verifyJwt(token);

    // ── 4. Injetar no request ──
    const user: AuthenticatedUser = {
      id: payload.sub,
      email: payload.email ?? '',
      appMetadata: payload.app_metadata,
      aal: payload.aal ?? undefined,
    };
    (request as Request & { user: AuthenticatedUser }).user = user;

    return true;
  }

  /**
   * Verificação manual de JWT HS256.
   * Evita dependência de bibliotecas externas para uma operação simples.
   */
  private verifyJwt(token: string): Record<string, any> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Token JWT malformado');
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // Verificar assinatura HMAC-SHA256
    const expectedSignature = createHmac('sha256', this.jwtSecret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    if (expectedSignature !== signatureB64) {
      throw new UnauthorizedException('Assinatura JWT inválida');
    }

    // Decodificar payload
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));

    // Verificar expiração
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Token expirado');
    }

    // Verificar se tem sub (user id)
    if (!payload.sub) {
      throw new UnauthorizedException('Token sem identificador de usuário (sub)');
    }

    return payload;
  }
}