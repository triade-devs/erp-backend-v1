import { IsOptional, IsString, IsIn, IsInt, Min, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO de query para listagem de movimentações com paginação e filtros.
 * Endpoint: GET /movements
 */
export class QueryMovementsDto {
  @ApiPropertyOptional({
    description: 'Filtrar por produto (UUID).',
    format: 'uuid',
  })
  @IsString()
  @IsOptional()
  product_id?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por tipo de movimentação.',
    enum: ['in', 'out', 'adjustment', 'loss'],
  })
  @IsString()
  @IsIn(['in', 'out', 'adjustment', 'loss'])
  @IsOptional()
  movement_type?: string;

  @ApiPropertyOptional({
    description: 'Data de início do filtro (ISO 8601).',
    example: '2026-01-01T00:00:00Z',
  })
  @IsDateString()
  @IsOptional()
  date_from?: string;

  @ApiPropertyOptional({
    description: 'Data de fim do filtro (ISO 8601).',
    example: '2026-12-31T23:59:59Z',
  })
  @IsDateString()
  @IsOptional()
  date_to?: string;

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
