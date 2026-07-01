import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO de query para listagem de fornecedores com paginação.
 * Endpoint: GET /suppliers
 */
export class QuerySuppliersDto {
  @ApiPropertyOptional({
    description: 'Busca por nome (contains, case-insensitive).',
    example: 'ABC',
  })
  @IsString()
  @IsOptional()
  search?: string;

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
