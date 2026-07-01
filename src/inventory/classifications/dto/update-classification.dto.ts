import { IsString, IsOptional, IsInt, Min, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para atualização de classificação de produto.
 * Endpoint: PATCH /inventory/classifications/:id
 *
 * Apenas name e sort_order são editáveis.
 * Não permite trocar level nem parent — isso quebraria a hierarquia.
 */
export class UpdateClassificationDto {
  @ApiPropertyOptional({
    description: 'Novo nome da classificação.',
    example: 'Informática',
    maxLength: 60,
  })
  @IsString()
  @IsOptional()
  @MaxLength(60)
  name?: string;

  @ApiPropertyOptional({
    description: 'Ordem de exibição.',
    default: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  sort_order?: number;
}
