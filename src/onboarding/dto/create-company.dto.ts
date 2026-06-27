import { IsString, IsNotEmpty, MaxLength, MinLength, Matches, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para criação de empresa via self-service (Porta 1).
 *
 * Endpoint: POST /onboarding/companies
 * Guard: @SkipTenant() (autenticado, sem tenant)
 */
export class CreateCompanyDto {
  @ApiProperty({
    description: 'Nome completo da empresa.',
    example: 'Acme Corporation Ltda',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty({ message: 'O nome da empresa é obrigatório.' })
  @MaxLength(255, { message: 'O nome deve ter no máximo 255 caracteres.' })
  name: string;

  /**
   * Slug único da empresa na URL.
   * Aceita apenas letras minúsculas, números e hífens.
   * Ex: "minha-empresa-ltda"
   */
  @ApiProperty({
    description:
      'Slug único da empresa, usado na URL. Apenas letras minúsculas, números e hífens. Não pode começar ou terminar com hífen.',
    example: 'acme-corporation',
    minLength: 3,
    maxLength: 63,
    pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
  })
  @IsString()
  @IsNotEmpty({ message: 'O slug é obrigatório.' })
  @MinLength(3, { message: 'O slug deve ter pelo menos 3 caracteres.' })
  @MaxLength(63, { message: 'O slug deve ter no máximo 63 caracteres.' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'O slug deve conter apenas letras minúsculas, números e hífens (sem hífens no início/fim).',
  })
  slug: string;

  @ApiPropertyOptional({
    description: 'CNPJ da empresa (com ou sem máscara).',
    example: '12.345.678/0001-90',
    maxLength: 18,
  })
  @IsString()
  @IsOptional()
  @MaxLength(18, { message: 'O CNPJ deve ter no máximo 18 caracteres.' })
  document?: string;

  @ApiPropertyOptional({
    description: 'Código do plano contratado.',
    example: 'starter',
    enum: ['free', 'starter', 'pro', 'business', 'enterprise'],
    maxLength: 50,
  })
  @IsString()
  @IsOptional()
  @MaxLength(50, { message: 'O código do plano deve ter no máximo 50 caracteres.' })
  plan_code?: string;
}