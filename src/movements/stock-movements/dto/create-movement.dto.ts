import { IsString, IsNotEmpty, IsOptional, IsNumber, IsIn, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para criação de movimentação de estoque.
 * Endpoint: POST /movements
 *
 * Único endpoint para os 4 tipos de movimentação.
 * Validação de campos obrigatórios por tipo é feita no service.
 */
export class CreateMovementDto {
  @ApiProperty({
    description: 'UUID do produto a movimentar.',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'product_id deve ser um UUID v4 válido.' })
  @IsNotEmpty()
  product_id: string;

  @ApiProperty({
    description:
      'Tipo de movimentação:\n' +
      '- `in`: Entrada de estoque (cria layer, exige `unit_cost`).\n' +
      '- `adjustment`: Ajuste positivo (cria layer, exige `unit_cost`).\n' +
      '- `out`: Saída de estoque (consome FIFO, ignora `unit_cost`).\n' +
      '- `loss`: Perda (consome FIFO, exige `reason`).',
    enum: ['in', 'out', 'adjustment', 'loss'],
  })
  @IsString()
  @IsIn(['in', 'out', 'adjustment', 'loss'], {
    message: 'movement_type deve ser: in, out, adjustment ou loss.',
  })
  movement_type: string;

  @ApiProperty({
    description: 'Quantidade a movimentar (sempre positiva).',
    example: 10,
    minimum: 0.001,
  })
  @IsNumber({}, { message: 'A quantidade deve ser um número.' })
  @Min(0.001, { message: 'A quantidade deve ser maior que zero.' })
  quantity: number;

  @ApiPropertyOptional({
    description:
      'Custo unitário. **Obrigatório** para `in` e `adjustment`. Ignorado para `out` e `loss`.',
    example: 49.90,
    minimum: 0,
  })
  @IsNumber({}, { message: 'O custo unitário deve ser um número.' })
  @Min(0)
  @IsOptional()
  unit_cost?: number;

  @ApiPropertyOptional({
    description:
      'Motivo da movimentação. **Obrigatório** para `loss`. Opcional para os demais.',
    example: 'Produto danificado durante transporte.',
  })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({
    description: 'UUID do fornecedor (usado em `in` para vincular ao lote).',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'supplier_id deve ser um UUID v4 válido.' })
  @IsOptional()
  supplier_id?: string;
}
