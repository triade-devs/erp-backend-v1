import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StockLayersService } from '../stock-layers/stock-layers.service.js';
import type { CreateMovementDto } from './dto/create-movement.dto.js';
import type { QueryMovementsDto } from './dto/query-movements.dto.js';
import type { TenantContext, AuthenticatedUser } from '../../common/interfaces/request-context.interface.js';

/**
 * StockMovementsService — Gerencia movimentações de estoque.
 *
 * POST /movements: único endpoint para os 4 tipos (in, out, adjustment, loss).
 * Toda operação roda em `prisma.$transaction()`.
 *
 * Como NÃO existe trigger no banco atualizando `products.stock`,
 * o serviço faz o increment/decrement explicitamente dentro da transação.
 */
@Injectable()
export class StockMovementsService {
  private readonly logger = new Logger(StockMovementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stockLayersService: StockLayersService,
  ) {}

  /**
   * Cria uma movimentação de estoque.
   *
   * Branch interno por movement_type:
   * - `in`: createLayer() + increment stock
   * - `adjustment`: createLayer() + increment stock
   * - `out`: consumeStock() + decrement stock
   * - `loss`: consumeStock() + decrement stock (reason obrigatório)
   */
  async create(dto: CreateMovementDto, tenant: TenantContext, user: AuthenticatedUser) {
    // ── Validações de negócio por tipo ──
    this.validateByType(dto);

    // Verifica que o produto existe e pertence ao tenant
    const product = await this.prisma.db.products.findFirst({
      where: { id: dto.product_id, company_id: tenant.companyId },
    });

    if (!product) {
      throw new NotFoundException(`Produto não encontrado: ${dto.product_id}`);
    }

    // ── Transação ACID ──
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Cria o registro de movimento
      const movement = await tx.stock_movements.create({
        data: {
          company_id: tenant.companyId,
          product_id: dto.product_id,
          movement_type: dto.movement_type as any,
          quantity: dto.quantity,
          unit_cost: dto.unit_cost ?? null,
          reason: dto.reason ?? null,
          performed_by: user.id,
        },
      });

      // 2. Branch por tipo
      if (dto.movement_type === 'in' || dto.movement_type === 'adjustment') {
        // Cria layer (lote de entrada)
        await this.stockLayersService.createLayer(tx, {
          companyId: tenant.companyId,
          productId: dto.product_id,
          supplierId: dto.supplier_id,
          unitCost: dto.unit_cost!,
          quantity: dto.quantity,
        });

        // Incrementa stock do produto (sem trigger)
        await tx.products.update({
          where: { id: dto.product_id },
          data: {
            stock: { increment: dto.quantity },
            updated_at: new Date(),
          },
        });
      } else {
        // out | loss → consome FIFO
        await this.stockLayersService.consumeStock(
          tx,
          tenant.companyId,
          dto.product_id,
          dto.quantity,
          movement.id,
        );

        // Decrementa stock do produto (sem trigger)
        await tx.products.update({
          where: { id: dto.product_id },
          data: {
            stock: { decrement: dto.quantity },
            updated_at: new Date(),
          },
        });
      }

      return movement;
    });

    this.logger.log(
      `Movimentação criada: id=${result.id} type=${dto.movement_type} ` +
        `product=${dto.product_id} qty=${dto.quantity} company=${tenant.companyId}`,
    );

    return result;
  }

  /**
   * Lista movimentações com filtros e paginação.
   */
  async findAll(tenant: TenantContext, query: QueryMovementsDto) {
    const { product_id, movement_type, date_from, date_to, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      company_id: tenant.companyId,
    };

    if (product_id) {
      where.product_id = product_id;
    }

    if (movement_type) {
      where.movement_type = movement_type;
    }

    if (date_from || date_to) {
      where.created_at = {
        ...(date_from && { gte: new Date(date_from) }),
        ...(date_to && { lte: new Date(date_to) }),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.db.stock_movements.findMany({
        where,
        include: {
          products: {
            select: { id: true, sku: true, name: true },
          },
          users: {
            select: { id: true },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.db.stock_movements.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retorna detalhe de uma movimentação, incluindo consumo por lote.
   */
  async findOne(id: string, tenant: TenantContext) {
    const movement = await this.prisma.db.stock_movements.findFirst({
      where: { id, company_id: tenant.companyId },
      include: {
        products: {
          select: { id: true, sku: true, name: true },
        },
        users: {
          select: { id: true },
        },
        movement_layer_consumption: {
          include: {
            stock_layers: {
              select: {
                id: true,
                unit_cost: true,
                entry_date: true,
                supplier_id: true,
              },
            },
          },
        },
      },
    });

    if (!movement) {
      throw new NotFoundException(`Movimentação não encontrada: ${id}`);
    }

    return movement;
  }

  /**
   * Validações de campos obrigatórios por tipo de movimentação.
   */
  private validateByType(dto: CreateMovementDto) {
    if ((dto.movement_type === 'in' || dto.movement_type === 'adjustment') && dto.unit_cost === undefined) {
      throw new BadRequestException(
        `Movimentações do tipo "${dto.movement_type}" exigem o campo unit_cost.`,
      );
    }

    if (dto.movement_type === 'loss' && (!dto.reason || dto.reason.trim() === '')) {
      throw new BadRequestException(
        'Movimentações do tipo "loss" exigem o campo reason (motivo da perda).',
      );
    }
  }
}
