import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';

/**
 * DTO para atualização de dados fiscais da empresa (Porta 1 - Fase 2).
 *
 * Endpoint: PATCH /onboarding/companies/:id/fiscal-data
 * Guard: @AllowDuringFiscalSetup() + @TenantProtected()
 *
 * Finaliza o onboarding: PENDING_FISCAL → ACTIVE
 */
export class UpdateFiscalDataDto {
  @IsString()
  @IsNotEmpty({ message: 'O CNPJ é obrigatório.' })
  @MaxLength(18, { message: 'O CNPJ deve ter no máximo 18 caracteres.' })
  document: string;

  /** Campos adicionais de dados fiscais podem ser adicionados aqui em versões futuras. */

  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;
}
