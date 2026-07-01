import { IsString, IsNotEmpty, IsOptional, IsIn, IsUUID, IsInt, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para criação de classificação de produto.
 * Endpoint: POST /inventory/classifications
 *
 * Hierarquia de 3 níveis: department → category → brand.
 * Validação de hierarquia no service (parent_id vs level).
 */
export class CreateClassificationDto {
  @ApiProperty({
    description: 'Nome da classificação.',
    example: 'Eletrônicos',
    maxLength: 60,
  })
  @IsString()
  @IsNotEmpty({ message: 'O nome da classificação é obrigatório.' })
  @MaxLength(60)
  name: string;

  @ApiProperty({
    description: 'Nível na hierarquia: department (raiz), category (filho de department), brand (filho de category).',
    enum: ['department', 'category', 'brand'],
    example: 'department',
  })
  @IsString()
  @IsIn(['department', 'category', 'brand'], {
    message: 'O level deve ser: department, category ou brand.',
  })
  level: string;

  @ApiPropertyOptional({
    description:
      'UUID do nó pai. Obrigatório para category (pai deve ser department) e brand (pai deve ser category). ' +
      'Deve ser `null` ou omitido para department.',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'parent_id deve ser um UUID v4 válido.' })
  @IsOptional()
  parent_id?: string;

  @ApiPropertyOptional({
    description: 'Ordem de exibição dentro do mesmo nível/pai.',
    default: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  sort_order?: number;
}
