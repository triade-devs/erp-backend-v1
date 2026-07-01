import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para criação de change request (fila de câmera).
 * Endpoint: POST /inventory/change-requests
 *
 * O operador lê o EAN pela câmera e submete a request.
 * Permission: `movements:movement:create` (operador sem `inventory:product:create`).
 */
export class CreateChangeRequestDto {
  @ApiProperty({
    description: 'Código EAN/GTIN lido pela câmera.',
    example: '7891234567890',
  })
  @IsString()
  @IsNotEmpty({ message: 'O EAN é obrigatório.' })
  ean: string;

  @ApiPropertyOptional({
    description:
      'Dados de enriquecimento pré-preenchidos pelo front (JSON livre).\n' +
      'Obtidos via `GET /inventory/products/enrich/barcode/:ean`.',
    example: { name: 'Teclado Mecânico', ncm: '8471.30.19', brand: 'MechBrand' },
  })
  @IsOptional()
  enrichment_data?: Record<string, unknown>;
}
