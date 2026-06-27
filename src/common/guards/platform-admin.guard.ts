import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../interfaces/request-context.interface.js';

/**
 * PlatformAdminGuard — Restringe acesso a administradores da plataforma.
 *
 * Lookup direto em `platform_admins` por `user.id`.
 * Sem relação com tenant — este é um guard de plataforma, não de empresa.
 *
 * Pré-requisito: SupabaseAuthGuard já deve ter executado (request.user populado).
 *
 * Fase F do plano consolidado.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  private readonly logger = new Logger(PlatformAdminGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();

    const user = request.user;
    if (!user) {
      throw new ForbiddenException('PlatformAdminGuard requer SupabaseAuthGuard ativo antes.');
    }

    const admin = await this.prisma.db.platform_admins.findUnique({
      where: { user_id: user.id },
      select: { user_id: true },
    });

    if (!admin) {
      this.logger.warn(`Acesso negado: user=${user.id} não é platform_admin.`);
      throw new ForbiddenException('Acesso restrito a administradores da plataforma.');
    }

    return true;
  }
}