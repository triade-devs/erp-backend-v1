import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiSecurity } from '@nestjs/swagger';
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
@ApiTags('Platform (Admin Interno)')
@ApiBearerAuth('supabase-jwt')
@ApiSecurity('platform-admin', [])
@SkipTenant()
@UseGuards(PlatformAdminGuard)
@Controller('platform')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  /**
   * POST /platform/support-grants
   */
  @Post('support-grants')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Criar support grant (acesso temporário de suporte)',
    description:
      '**Exclusivo para Platform Admins.**\n\n' +
      'Cria um grant de acesso temporário de suporte para que um operador do time ' +
      'interno acesse uma empresa cliente por **até 15 minutos**.\n\n' +
      '**Garantias de segurança aplicadas:**\n\n' +
      '- 🔑 **Regra de quatro olhos:** `support_user_id` não pode ser igual ao usuário que está criando o grant. ' +
      'Outro admin deve autorizar o acesso.\n' +
      '- 🔐 **MFA condicional:** se `SUPPORT_MFA_ENFORCED=true` (env), exige `aal2` (autenticador TOTP). ' +
      'O claim `aal` é extraído do JWT Supabase.\n' +
      '- ⏱ **TTL calculado no servidor:** `expires_at = now() + 15 minutos`. ' +
      'O client nunca envia a duração.\n' +
      '- 🔍 **Validação de elegibilidade:** o `support_user_id` deve ser um `platform_admin` existente.\n' +
      '- 📋 **Auditoria total:** todas as ações do operador durante o grant ficam registradas com `isSupportProxy=true`, ' +
      'inclusive leituras (GETs).\n\n' +
      '**Como usar o grant:**\n\n' +
      'Após criar o grant, o operador usa o `grantId` retornado como valor do header `X-Support-Grant` ' +
      'em cada requisição à empresa alvo, junto com `X-Company-Id`.',
  })
  @ApiResponse({
    status: 201,
    description: 'Grant criado com sucesso. Válido por 15 minutos a partir de `startedAt`.',
    schema: {
      example: {
        grantId: 'e9a1f2b3-c4d5-6e7f-8a9b-0c1d2e3f4a5b',
        companyId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        supportUserId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        grantedBy: 'b3c4d5e6-f7a8-9b0c-1d2e-3f4a5b6c7d8e',
        startedAt: '2026-06-27T19:00:00.000Z',
        expiresAt: '2026-06-27T19:15:00.000Z',
        reason: 'Investigar erro de movimentação de estoque reportado pelo cliente no ticket #4521.',
        ttlMinutes: 15,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Dados inválidos. Possíveis causas:\n' +
      '- `support_user_id` igual ao `granted_by` (regra de quatro olhos)\n' +
      '- `company_id` não encontrado\n' +
      '- `support_user_id` não é um platform_admin',
    schema: {
      example: {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Você não pode criar um grant de suporte para si mesmo (regra de quatro olhos).',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'JWT ausente ou inválido.' })
  @ApiResponse({
    status: 403,
    description:
      'Acesso negado. Possíveis causas:\n' +
      '- Usuário não é `platform_admin`\n' +
      '- `SUPPORT_MFA_ENFORCED=true` e o token não tem `aal2`',
    schema: {
      example: {
        statusCode: 403,
        error: 'Forbidden',
        message: 'Autenticação multifator (MFA) é obrigatória para criar support grants.',
      },
    },
  })
  async createSupportGrant(@Body() dto: CreateSupportGrantDto, @CurrentUser() user: AuthenticatedUser) {
    return this.platformService.createSupportGrant(dto, user);
  }
}