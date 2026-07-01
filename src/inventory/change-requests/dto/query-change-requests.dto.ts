import { IsOptional, IsString, IsIn, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO de query para listagem de change requests com filtro e paginação.
 * Endpoint: GET /inventory/change-requests
 */
export class QueryChangeRequestsDto {
  @ApiPropertyOptional({
    description: 'Filtrar por status.',
    enum: ['pending', 'confirmed', 'rejected'],
  })
  @IsString()
  @IsIn(['pending', 'confirmed', 'rejected'])
  @IsOptional()
  status?: string;

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
