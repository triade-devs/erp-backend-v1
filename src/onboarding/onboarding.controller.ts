import { Body, Controller, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
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
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // E1 — Criar empresa (self-service)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * POST /onboarding/companies
   *
   * Cria uma nova empresa e configura o usuário autenticado como administrador.
   * Retorna a empresa criada em status PENDING_FISCAL, aguardando dados fiscais.
   */
  @SkipTenant()
  @Post('companies')
  @HttpCode(HttpStatus.CREATED)
  async createCompany(@Body() dto: CreateCompanyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.onboardingService.createCompany(dto, user.id);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // E2 — Dados fiscais (PENDING_FISCAL → ACTIVE)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * PATCH /onboarding/companies/:id/fiscal-data
   *
   * Finaliza o onboarding da empresa preenchendo os dados fiscais.
   * Avança setup_status de PENDING_FISCAL para ACTIVE.
   *
   * Requer @TenantProtected() + @AllowDuringFiscalSetup() para operar
   * enquanto a empresa ainda está em PENDING_FISCAL.
   */
  @AllowDuringFiscalSetup()
  @TenantProtected()
  @Patch('companies/:id/fiscal-data')
  @HttpCode(HttpStatus.OK)
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

  /**
   * POST /onboarding/invitations/:shortCode/accept
   *
   * Aceita um convite para ingressar em uma empresa.
   * O `shortCode` é apenas a chave de lookup; o `token` no body
   * é o segredo real validado por hash (decisão #7).
   */
  @SkipTenant()
  @Post('invitations/:shortCode/accept')
  @HttpCode(HttpStatus.OK)
  async acceptInvitation(
    @Param('shortCode') shortCode: string,
    @Body() dto: AcceptInvitationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.onboardingService.acceptInvitation(shortCode, dto, user.id);
  }
}