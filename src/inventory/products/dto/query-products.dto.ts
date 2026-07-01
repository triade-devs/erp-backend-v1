import { IsOptional, IsString, IsBoolean, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO de query para listagem de produtos com paginação e filtros.
 * Endpoint: GET /inventory/products
 */
export class QueryProductsDto {
  @ApiPropertyOptional({
    description: 'Busca por nome ou SKU (contains, case-insensitive).',
    example: 'teclado',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por classificação (UUID).',
    format: 'uuid',
  })
  @IsString()
  @IsOptional()
  classification_id?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por status ativo/inativo.',
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiPropertyOptional({
    description: 'Página (1-indexed).',
    default: 1,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Itens por página.',
    default: 20,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}
