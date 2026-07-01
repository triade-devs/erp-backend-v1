import { IsString, IsNotEmpty, IsOptional, IsEmail, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para criação de fornecedor.
 * Endpoint: POST /suppliers
 */
export class CreateSupplierDto {
  @ApiProperty({
    description: 'Nome do fornecedor.',
    example: 'Distribuidora ABC Ltda',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty({ message: 'O nome do fornecedor é obrigatório.' })
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    description: 'CNPJ ou CPF do fornecedor.',
    example: '12.345.678/0001-90',
  })
  @IsString()
  @IsOptional()
  document?: string;

  @ApiPropertyOptional({
    description: 'Telefone de contato.',
    example: '(11) 99999-9999',
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    description: 'E-mail de contato.',
    example: 'contato@distribuidora-abc.com.br',
  })
  @IsEmail({}, { message: 'O e-mail deve ser válido.' })
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: 'País.',
    example: 'Brasil',
  })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({
    description: 'Estado / UF.',
    example: 'SP',
  })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional({
    description: 'Cidade.',
    example: 'São Paulo',
  })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({
    description: 'CEP.',
    example: '01001-000',
  })
  @IsString()
  @IsOptional()
  cep?: string;
}
