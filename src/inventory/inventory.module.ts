import { Module } from '@nestjs/common';
import { EnrichmentModule } from '../enrichment/enrichment.module.js';
import { MovementsModule } from '../movements/movements.module.js';
import { ClassificationsController } from './classifications/classifications.controller.js';
import { ClassificationsService } from './classifications/classifications.service.js';
import { ProductsController } from './products/products.controller.js';
import { ProductsService } from './products/products.service.js';
import { ChangeRequestsController } from './change-requests/change-requests.controller.js';
import { ChangeRequestsService } from './change-requests/change-requests.service.js';

/**
 * InventoryModule — Módulo container do domínio de inventário.
 *
 * module_code: inventory
 * Agrupa 3 subdomínios:
 *   • Classifications — árvore de categorias (department → category → brand)
 *   • Products — CRUD de produtos
 *   • ChangeRequests — fila de câmera
 *
 * Importa:
 *   • EnrichmentModule — para autopreenchimento por EAN e NCM
 *   • MovementsModule — para StockLayersService usado nas aprovações de change requests
 */
@Module({
  imports: [EnrichmentModule, MovementsModule],
  controllers: [
    ClassificationsController,
    ProductsController,
    ChangeRequestsController,
  ],
  providers: [
    ClassificationsService,
    ProductsService,
    ChangeRequestsService,
  ],
})
export class InventoryModule {}
