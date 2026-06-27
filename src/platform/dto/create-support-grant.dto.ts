import { IsString, IsNotEmpty, IsUUID, MinLength, MaxLength } from 'class-validator';

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
  @IsUUID('4', { message: 'support_user_id deve ser um UUID v4 válido.' })
  @IsNotEmpty()
  support_user_id: string;

  @IsUUID('4', { message: 'company_id deve ser um UUID v4 válido.' })
  @IsNotEmpty()
  company_id: string;

  /**
   * Motivo do acesso de suporte — frase real, não texto decorativo.
   * Mínimo de 20 caracteres para garantir que seja descritivo.
   */
  @IsString()
  @IsNotEmpty({ message: 'O motivo do acesso é obrigatório.' })
  @MinLength(20, {
    message: 'O motivo deve ter pelo menos 20 caracteres. Descreva o problema de forma clara.',
  })
  @MaxLength(500, { message: 'O motivo deve ter no máximo 500 caracteres.' })
  reason: string;
}
