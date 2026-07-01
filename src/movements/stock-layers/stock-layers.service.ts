import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Decimal } from '../../../generated/prisma/runtime/library.js';

/**
 * StockLayersService — Serviço interno do motor FIFO.
 *
 * Dois métodos consumidos pelo StockMovementsService — nunca expostos via controller.
 *
 * PROIBIÇÃO EXPLÍCITA: nunca fazer `UPDATE products SET stock = X` diretamente.
 * O campo `products.stock` é atualizado pelo StockMovementsService dentro da
 * mesma transação (increment/decrement explícito, já que não existe trigger no banco).
 */
@Injectable()
export class StockLayersService {
  private readonly logger = new Logger(StockLayersService.name);

  /**
   * Cria um novo lote (layer) de estoque.
   *
   * Chamado pelos tipos `in` e `adjustment` do StockMovementsService.
   * Sempre dentro de uma transação Prisma.
   *
   * @param tx - Prisma transaction client
   * @param data - Dados do lote
   */
  async createLayer(
    tx: any,
    data: {
      companyId: string;
      productId: string;
      supplierId?: string;
      unitCost: number;
      quantity: number;
    },
  ) {
    const layer = await tx.stock_layers.create({
      data: {
        company_id: data.companyId,
        product_id: data.productId,
        supplier_id: data.supplierId ?? null,
        unit_cost: data.unitCost,
        quantity_remaining: data.quantity,
      },
    });

    this.logger.debug(
      `Layer criada: id=${layer.id} product=${data.productId} qty=${data.quantity} cost=${data.unitCost}`,
    );
    return layer;
  }

  /**
   * Consumo FIFO de estoque — implementação fiel à spec canônica.
   *
   * 1. SELECT ... FOR UPDATE ordenado por entry_date ASC — trava pessimista.
   * 2. Loop de abatimento: para cada lote, calcula deductFromThisLayer = min(layer.quantity_remaining, remainingToDeduct).
   * 3. UPDATE stock_layers SET quantity_remaining -= deductFromThisLayer.
   * 4. INSERT movement_layer_consumption com a fatia exata.
   * 5. Se ao final remainingToDeduct > 0 → BadRequestException.
   *
   * @param tx - Prisma transaction client
   * @param companyId - ID da empresa
   * @param productId - ID do produto
   * @param qtyNeeded - Quantidade a consumir
   * @param movementId - ID do movimento (para vincular consumptions)
   */
  async consumeStock(
    tx: any,
    companyId: string,
    productId: string,
    qtyNeeded: number,
    movementId: string,
  ) {
    // 1. Seleciona lotes com saldo, travando pessimisticamente (FIFO order)
    const layers: Array<{
      id: string;
      quantity_remaining: Decimal;
      unit_cost: Decimal;
    }> = await tx.$queryRaw`
      SELECT id, quantity_remaining, unit_cost
      FROM "public"."stock_layers"
      WHERE company_id = ${companyId}::uuid
        AND product_id = ${productId}::uuid
        AND quantity_remaining > 0
      ORDER BY entry_date ASC
      FOR UPDATE
    `;

    let remainingToDeduct = qtyNeeded;
    const consumptions: Array<{ layerId: string; quantity: number; unitCost: number }> = [];

    // 2. Loop de abatimento FIFO
    for (const layer of layers) {
      if (remainingToDeduct <= 0) break;

      const layerQty = Number(layer.quantity_remaining);
      const deductFromThisLayer = Math.min(layerQty, remainingToDeduct);

      // 3. Atualiza saldo do lote
      await tx.$executeRaw`
        UPDATE "public"."stock_layers"
        SET quantity_remaining = quantity_remaining - ${deductFromThisLayer}::decimal
        WHERE id = ${layer.id}::uuid
      `;

      consumptions.push({
        layerId: layer.id,
        quantity: deductFromThisLayer,
        unitCost: Number(layer.unit_cost),
      });

      remainingToDeduct -= deductFromThisLayer;
    }

    // 5. Verifica furo de integridade
    if (remainingToDeduct > 0.001) {
      // Margem de 0.001 para erros de ponto flutuante
      throw new BadRequestException(
        `Furo de integridade: Saldo físico menor que a requisição transacional. ` +
          `Faltam ${remainingToDeduct.toFixed(3)} unidades do produto ${productId}.`,
      );
    }

    // 4. Insere registros de consumo por lote
    for (const consumption of consumptions) {
      await tx.movement_layer_consumption.create({
        data: {
          movement_id: movementId,
          layer_id: consumption.layerId,
          quantity: consumption.quantity,
          unit_cost: consumption.unitCost,
        },
      });
    }

    this.logger.debug(
      `Consumo FIFO: product=${productId} qty=${qtyNeeded} layers_consumed=${consumptions.length}`,
    );

    return consumptions;
  }
}
