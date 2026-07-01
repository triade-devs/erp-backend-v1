import { IsString, IsNotEmpty, IsOptional, IsNumber, IsUUID, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para criação de produto.
 * Endpoint: POST /inventory/products
 *
 * `stock` não é campo do DTO — nasce 0 pelo default do schema.
 * `cost_price` não existe no schema — não entra no DTO.
 */
export class CreateProductDto {
  @ApiProperty({
    description: 'Código SKU do produto (único por empresa).',
    example: 'PROD-001',
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
    example: 'Teclado mecânico com switches Cherry MX Blue e iluminação RGB.',
  })
  @IsString()
  @IsNotEmpty({ message: 'A descrição é obrigatória.' })
  description: string;

  @ApiPropertyOptional({
    description: 'Unidade de medida.',
    default: 'UN',
    example: 'UN',
  })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiPropertyOptional({
    description: 'Preço de venda.',
    example: 299.90,
    minimum: 0,
  })
  @IsNumber({}, { message: 'O preço de venda deve ser um número.' })
  @Min(0)
  @IsOptional()
  sale_price?: number;

  @ApiPropertyOptional({
    description: 'Estoque mínimo (alerta de reposição).',
    example: 5,
    minimum: 0,
  })
  @IsNumber({}, { message: 'O estoque mínimo deve ser um número.' })
  @Min(0)
  @IsOptional()
  min_stock?: number;

  @ApiProperty({
    description: 'Código NCM (Nomenclatura Comum do Mercosul).',
    example: '8471.30.19',
  })
  @IsString()
  @IsNotEmpty({ message: 'O NCM é obrigatório.' })
  ncm: string;

  @ApiPropertyOptional({
    description: 'Código de barras (EAN/GTIN).',
    example: '7891234567890',
  })
  @IsString()
  @IsOptional()
  barcode?: string;

  @ApiPropertyOptional({
    description: 'Localização no estoque (prateleira, galpão, etc.).',
    example: 'Prateleira A3',
  })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({
    description:
      'UUID da classificação do produto (qualquer nível: department, category ou brand).',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'classification_id deve ser um UUID v4 válido.' })
  @IsOptional()
  classification_id?: string;
}
