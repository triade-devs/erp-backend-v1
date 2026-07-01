import { Module } from '@nestjs/common';
import { StockMovementsController } from './stock-movements/stock-movements.controller.js';
import { StockMovementsService } from './stock-movements/stock-movements.service.js';
import { StockLayersService } from './stock-layers/stock-layers.service.js';

/**
 * MovementsModule — Motor de movimentação de estoque.
 *
 * module_code: movements
 * Contém o motor FIFO (StockLayersService — sem rotas) e os
 * endpoints públicos de movimentação (StockMovementsService).
 */
@Module({
  controllers: [StockMovementsController],
  providers: [StockMovementsService, StockLayersService],
  exports: [StockMovementsService, StockLayersService],
})
export class MovementsModule {}
