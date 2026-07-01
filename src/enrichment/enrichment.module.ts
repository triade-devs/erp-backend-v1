import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { EnrichmentService } from './enrichment.service.js';

/**
 * EnrichmentModule — Cliente HTTP interno para os microserviços de enriquecimento.
 *
 * Sem rotas públicas — é um módulo de infraestrutura consumido
 * por SuppliersModule e InventoryModule.
 *
 * Timeout global de 2500ms aplicado a todos os 4 clientes.
 */
@Module({
  imports: [
    HttpModule.register({
      timeout: 2500,
      maxRedirects: 3,
    }),
  ],
  providers: [EnrichmentService],
  exports: [EnrichmentService],
})
export class EnrichmentModule {}
