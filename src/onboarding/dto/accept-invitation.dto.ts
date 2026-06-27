import { IsString, IsNotEmpty, Length } from 'class-validator';

/**
 * DTO para aceite de convite por um novo usuário (Portas 2 e 3).
 *
 * Endpoint: POST /onboarding/invitations/:shortCode/accept
 * Guard: @SkipTenant() (autenticado, sem tenant)
 *
 * Segurança: short_code é apenas a chave de lookup — o token secreto
 * é comparado via hash contra token_hash armazenado (decisão #7).
 */
export class AcceptInvitationDto {
  /**
   * Token secreto do convite, enviado no corpo da requisição.
   * Nunca confiar só no short_code da URL — o token é o segredo real.
   */
  @IsString()
  @IsNotEmpty({ message: 'O token do convite é obrigatório.' })
  @Length(32, 128, { message: 'Token inválido.' })
  token: string;
}
