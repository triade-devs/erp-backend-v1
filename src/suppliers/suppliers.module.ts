import { Module } from '@nestjs/common';
import { EnrichmentModule } from '../enrichment/enrichment.module.js';
import { SuppliersController } from './suppliers.controller.js';
import { SuppliersService } from './suppliers.service.js';

/**
 * SuppliersModule — CRUD de fornecedores.
 *
 * module_code: suppliers
 * Importa EnrichmentModule para autopreenchimento por CNPJ.
 */
@Module({
  imports: [EnrichmentModule],
  controllers: [SuppliersController],
  providers: [SuppliersService],
})
export class SuppliersModule {}
