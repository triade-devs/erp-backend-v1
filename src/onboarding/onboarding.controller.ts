import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service.js';
import { CreateCompanyDto } from './dto/create-company.dto.js';
import { UpdateFiscalDataDto } from './dto/update-fiscal-data.dto.js';
import { AcceptInvitationDto } from './dto/accept-invitation.dto.js';
import { SkipTenant } from '../common/decorators/skip-tenant.decorator.js';
import { TenantProtected } from '../common/decorators/tenant-protected.decorator.js';
import { AllowDuringFiscalSetup } from '../common/decorators/allow-during-fiscal-setup.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator.js';
import type { AuthenticatedUser, TenantContext } from '../common/interfaces/request-context.interface.js';

/**
 * OnboardingController — As três portas de entrada no sistema.
 *
 * E1 – POST /onboarding/companies
 *      Self-service: usuário autenticado cria sua empresa.
 *      @SkipTenant() — autenticado, sem tenant resolvido.
 *
 * E2 – PATCH /onboarding/companies/:id/fiscal-data
 *      Finaliza dados fiscais da empresa recém-criada.
 *      @TenantProtected() + @AllowDuringFiscalSetup() — empresa em PENDING_FISCAL.
 *
 * E3 – POST /onboarding/invitations/:shortCode/accept
 *      Aceite de convite (Portas 2 e 3).
 *      @SkipTenant() — autenticado, sem tenant resolvido.
 */
@ApiTags('Onboarding')
@ApiBearerAuth('supabase-jwt')
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // E1 — Criar empresa (self-service)
  // ─────────────────────────────────────────────────────────────────────────────

  @SkipTenant()
  @Post('companies')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Criar empresa (self-service)',
    description:
      'Cria uma nova empresa e configura automaticamente o usuário autenticado como administrador. ' +
      'Executa em transação atômica:\n\n' +
      '1. Cria a empresa\n' +
      '2. Gera as roles padrão (`owner`, `manager`, `operator`) com suas permissões\n' +
      '3. Cria `company_settings` (moeda BRL, fuso América/São Paulo)\n' +
      '4. Cria classificação de produto raiz `"GERAL"`\n' +
      '5. Vincula o usuário como administrador (membership ACTIVE)\n\n' +
      'Retorna a empresa com `setup_status = PENDING_FISCAL`. ' +
      'O próximo passo é chamar `PATCH /onboarding/companies/:id/fiscal-data` para ativá-la.',
  })
  @ApiResponse({
    status: 201,
    description: 'Empresa criada com sucesso. Status inicial: PENDING_FISCAL.',
    schema: {
      example: {
        companyId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        name: 'Acme Corporation Ltda',
        slug: 'acme-corporation',
        setupStatus: 'PENDING_FISCAL',
        adminRoleId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos (validação de DTO).' })
  @ApiResponse({ status: 401, description: 'JWT ausente ou inválido.' })
  @ApiResponse({
    status: 409,
    description: 'Já existe uma empresa com este slug.',
    schema: {
      example: {
        statusCode: 409,
        error: 'Conflict',
        message: 'Já existe uma empresa com o slug "acme-corporation". Escolha outro slug.',
      },
    },
  })
  async createCompany(@Body() dto: CreateCompanyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.onboardingService.createCompany(dto, user.id);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // E2 — Dados fiscais (PENDING_FISCAL → ACTIVE)
  // ─────────────────────────────────────────────────────────────────────────────

  @AllowDuringFiscalSetup()
  @TenantProtected()
  @Patch('companies/:id/fiscal-data')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Finalizar dados fiscais (PENDING_FISCAL → ACTIVE)',
    description:
      'Preenche os dados fiscais da empresa e avança o `setup_status` de `PENDING_FISCAL` para `ACTIVE`.\n\n' +
      '**Requer** o header `X-Company-Id` com o UUID da empresa.\n\n' +
      'Este endpoint usa `@AllowDuringFiscalSetup()` para ser acessível mesmo enquanto ' +
      'a empresa ainda não está totalmente ativa. Após a chamada com sucesso, ' +
      'a empresa fica operacional e o usuário pode acessar os demais módulos.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID da empresa a ter os dados fiscais atualizados (deve corresponder ao tenant do header).',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    format: 'uuid',
  })
  @ApiHeader({
    name: 'X-Company-Id',
    description: 'UUID da empresa (tenant). Obrigatório para rotas @TenantProtected().',
    required: true,
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @ApiResponse({
    status: 200,
    description: 'Dados fiscais salvos. Empresa ativada (setup_status = ACTIVE).',
    schema: {
      example: {
        companyId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        setupStatus: 'ACTIVE',
        document: '12.345.678/0001-90',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos (ex: CNPJ ausente).' })
  @ApiResponse({ status: 401, description: 'JWT ausente ou inválido.' })
  @ApiResponse({
    status: 403,
    description: 'Membership inativo ou empresa em status incompatível.',
  })
  @ApiResponse({
    status: 423,
    description:
      'Empresa em status PENDING_FISCAL — apenas endpoints com @AllowDuringFiscalSetup() são permitidos. ' +
      'Este endpoint tem essa exceção, portanto 423 não deve ocorrer nesta rota.',
  })
  async updateFiscalData(
    @Param('id') companyId: string,
    @Body() dto: UpdateFiscalDataDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenant: TenantContext,
  ) {
    // Garante que o usuário só atualiza dados da empresa do seu tenant
    const targetCompanyId = tenant.companyId;
    return this.onboardingService.updateFiscalData(targetCompanyId, dto, user.id);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // E3 — Aceite de convite
  // ─────────────────────────────────────────────────────────────────────────────

  @SkipTenant()
  @Post('invitations/:shortCode/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Aceitar convite de empresa',
    description:
      'Aceita um convite para ingressar em uma empresa como membro.\n\n' +
      '**Segurança:** O `shortCode` na URL é apenas a chave de lookup pública. ' +
      'O `token` no body é o segredo real — comparado via hash seguro (SHA-256) ' +
      'contra o `token_hash` armazenado. Nunca confiar apenas no shortCode.\n\n' +
      'Em transação atômica:\n\n' +
      '1. Valida expiração e status do convite\n' +
      '2. Cria ou atualiza o membership do usuário autenticado\n' +
      '3. Atribui as roles definidas no convite\n' +
      '4. Marca o convite como aceito',
  })
  @ApiParam({
    name: 'shortCode',
    description:
      'Código curto do convite, presente no link do e-mail. ' + 'Não é o segredo — o token no body é o segredo real.',
    example: 'inv_x7k2m9',
  })
  @ApiResponse({
    status: 200,
    description: 'Convite aceito. Usuário vinculado à empresa com as roles definidas.',
    schema: {
      example: {
        membershipId: 'd9b23c4e-5f6a-7b8c-9d0e-1f2a3b4c5d6e',
        companyId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        companySlug: 'acme-corporation',
        status: 'active',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Token inválido, expirado ou convite já utilizado.' })
  @ApiResponse({ status: 401, description: 'JWT ausente ou inválido.' })
  @ApiResponse({ status: 404, description: 'Convite não encontrado para o shortCode informado.' })
  async acceptInvitation(
    @Param('shortCode') shortCode: string,
    @Body() dto: AcceptInvitationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.onboardingService.acceptInvitation(shortCode, dto, user.id);
  }
}