import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { PlatformService } from './platform.service.js';
import { CreateSupportGrantDto } from './dto/create-support-grant.dto.js';
import { SkipTenant } from '../common/decorators/skip-tenant.decorator.js';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/interfaces/request-context.interface.js';

/**
 * PlatformController — Operações administrativas de plataforma.
 *
 * Acesso restrito a `platform_admins`.
 * Todas as rotas usam @SkipTenant() (operações sem contexto de empresa específica)
 * e PlatformAdminGuard (verificação de platform_admins).
 */
@SkipTenant()
@UseGuards(PlatformAdminGuard)
@Controller('platform')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  /**
   * POST /platform/support-grants
   *
   * Cria um support access grant para acesso temporário de suporte (15 min).
   *
   * Segurança:
   * - Apenas platform_admins podem chamar (PlatformAdminGuard).
   * - MFA obrigatório se SUPPORT_MFA_ENFORCED=true (verificado no service).
   * - Regra de quatro olhos: support_user_id !== grantor (verificado no service).
   * - expires_at calculado no servidor, nunca aceito do client.
   *
   * Retorna o `grantId` para o operador de suporte usar como X-Support-Grant.
   */
  @Post('support-grants')
  @HttpCode(HttpStatus.CREATED)
  async createSupportGrant(@Body() dto: CreateSupportGrantDto, @CurrentUser() user: AuthenticatedUser) {
    return this.platformService.createSupportGrant(dto, user);
  }
}