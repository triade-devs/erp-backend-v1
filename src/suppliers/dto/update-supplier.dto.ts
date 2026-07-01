import { PartialType } from '@nestjs/swagger';
import { CreateSupplierDto } from './create-supplier.dto.js';

/**
 * DTO para atualização parcial de fornecedor.
 * Endpoint: PATCH /suppliers/:id
 *
 * Todos os campos de CreateSupplierDto são opcionais.
 */
export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {}
