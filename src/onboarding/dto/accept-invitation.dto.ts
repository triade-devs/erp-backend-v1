import { IsString, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
  @ApiProperty({
    description:
      'Token secreto do convite recebido por e-mail. ' +
      'O `shortCode` na URL é apenas a chave de lookup; ' +
      'este token é o segredo real validado por hash seguro no servidor. ' +
      'Deve ter entre 32 e 128 caracteres.',
    example: 'a3f8c1d2e4b5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1',
    minLength: 32,
    maxLength: 128,
  })
  @IsString()
  @IsNotEmpty({ message: 'O token do convite é obrigatório.' })
  @Length(32, 128, { message: 'Token inválido.' })
  token: string;
}
