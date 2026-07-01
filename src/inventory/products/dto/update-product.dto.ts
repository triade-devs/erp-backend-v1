import { PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto.js';

/**
 * DTO para atualização parcial de produto.
 * Endpoint: PATCH /inventory/products/:id
 *
 * Todos os campos de CreateProductDto são opcionais.
 * Quando `sale_price` muda, o service insere automaticamente em `sale_price_history`.
 */
export class UpdateProductDto extends PartialType(CreateProductDto) {}
