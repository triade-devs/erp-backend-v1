import { IsString, IsNotEmpty, IsUUID, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para criação de Support Grant.
 *
 * Endpoint: POST /platform/support-grants
 * Guard: @SkipTenant() + PlatformAdminGuard (+ MFA condicional)
 *
 * Campos aceitos do client — `expires_at` é sempre calculado no servidor.
 * Regra de quatro olhos: support_user_id !== granted_by (validado no service).
 */
export class CreateSupportGrantDto {
  @ApiProperty({
    description:
      'UUID v4 do usuário de suporte que receberá acesso temporário à empresa. ' +
      'Deve ser um platform_admin diferente do usuário que está criando o grant ' +
      '(regra de quatro olhos).',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'support_user_id deve ser um UUID v4 válido.' })
  @IsNotEmpty()
  support_user_id: string;

  @ApiProperty({
    description: 'UUID v4 da empresa que o suporte irá acessar.',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'company_id deve ser um UUID v4 válido.' })
  @IsNotEmpty()
  company_id: string;

  @ApiProperty({
    description:
      'Motivo descritivo do acesso de suporte. ' +
      'Deve ser uma frase real e clara — mínimo de 20 caracteres. ' +
      'Este campo é auditado e visível para a empresa cliente.',
    example: 'Investigar erro de movimentação de estoque reportado pelo cliente no ticket #4521.',
    minLength: 20,
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty({ message: 'O motivo do acesso é obrigatório.' })
  @MinLength(20, {
    message: 'O motivo deve ter pelo menos 20 caracteres. Descreva o problema de forma clara.',
  })
  @MaxLength(500, { message: 'O motivo deve ter no máximo 500 caracteres.' })
  reason: string;
}