import { IsString, IsNotEmpty, IsNumber, IsOptional, IsUUID, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para aprovação de change request.
 * Endpoint: POST /inventory/change-requests/:id/approve
 *
 * O gerente aprova e fornece os dados finais do produto + primeira entrada.
 */
export class ApproveChangeRequestDto {
  @ApiProperty({
    description: 'SKU do produto a ser criado.',
    example: 'PROD-NEW-001',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty({ message: 'O SKU é obrigatório.' })
  @MaxLength(255)
  sku: string;

  @ApiProperty({
    description: 'Nome do produto.',
    example: 'Teclado Mecânico RGB',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty({ message: 'O nome é obrigatório.' })
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'Descrição do produto.',
    example: 'Teclado mecânico com switches Cherry MX.',
  })
  @IsString()
  @IsNotEmpty({ message: 'A descrição é obrigatória.' })
  description: string;

  @ApiProperty({
    description: 'Código NCM.',
    example: '8471.30.19',
  })
  @IsString()
  @IsNotEmpty({ message: 'O NCM é obrigatório.' })
  ncm: string;

  @ApiProperty({
    description: 'Quantidade da primeira entrada de estoque.',
    example: 10,
    minimum: 0.001,
  })
  @IsNumber()
  @Min(0.001, { message: 'A quantidade deve ser maior que zero.' })
  quantity: number;

  @ApiProperty({
    description: 'Custo unitário para o lote de entrada.',
    example: 49.90,
    minimum: 0,
  })
  @IsNumber()
  @Min(0, { message: 'O custo unitário não pode ser negativo.' })
  unit_cost: number;

  @ApiPropertyOptional({
    description: 'Preço de venda.',
    example: 129.90,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  sale_price?: number;

  @ApiPropertyOptional({
    description: 'Unidade de medida.',
    default: 'UN',
  })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiPropertyOptional({
    description: 'UUID da classificação.',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'classification_id deve ser um UUID v4 válido.' })
  @IsOptional()
  classification_id?: string;

  @ApiPropertyOptional({
    description: 'UUID do fornecedor.',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'supplier_id deve ser um UUID v4 válido.' })
  @IsOptional()
  supplier_id?: string;
}
