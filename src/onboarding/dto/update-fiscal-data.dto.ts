import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para atualização de dados fiscais da empresa (Porta 1 - Fase 2).
 *
 * Endpoint: PATCH /onboarding/companies/:id/fiscal-data
 * Guard: @AllowDuringFiscalSetup() + @TenantProtected()
 *
 * Finaliza o onboarding: PENDING_FISCAL → ACTIVE
 */
export class UpdateFiscalDataDto {
  @ApiProperty({
    description:
      'CNPJ da empresa. Com ou sem máscara. ' +
      'Obrigatório para finalizar o onboarding e ativar a empresa (PENDING_FISCAL → ACTIVE).',
    example: '12.345.678/0001-90',
    maxLength: 18,
  })
  @IsString()
  @IsNotEmpty({ message: 'O CNPJ é obrigatório.' })
  @MaxLength(18, { message: 'O CNPJ deve ter no máximo 18 caracteres.' })
  document: string;

  @ApiPropertyOptional({
    description: 'Nome fantasia ou razão social da empresa, se diferente do nome original.',
    example: 'Acme Corp',
    maxLength: 255,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;
}