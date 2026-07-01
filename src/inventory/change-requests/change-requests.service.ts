import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StockLayersService } from '../../movements/stock-layers/stock-layers.service.js';
import type { CreateChangeRequestDto } from './dto/create-change-request.dto.js';
import type { ApproveChangeRequestDto } from './dto/approve-change-request.dto.js';
import type { QueryChangeRequestsDto } from './dto/query-change-requests.dto.js';
import type { TenantContext, AuthenticatedUser } from '../../common/interfaces/request-context.interface.js';

/**
 * ChangeRequestsService — Fila de câmera para cadastro de novos produtos.
 *
 * Fluxo:
 * 1. Operador lê EAN pela câmera → submete POST /inventory/change-requests (status: 'pending').
 * 2. Gerente lista pendentes → GET /inventory/change-requests?status=pending.
 * 3. Gerente aprova → POST /inventory/change-requests/:id/approve — transação ACID:
 *    - Cria produto
 *    - Cria stock_movements tipo `in` (primeira entrada)
 *    - Cria layer via StockLayersService
 *    - Atualiza stock do produto
 *    - Atualiza request → status: 'confirmed'
 * 4. Ou rejeita → POST /inventory/change-requests/:id/reject.
 */
@Injectable()
export class ChangeRequestsService {
  private readonly logger = new Logger(ChangeRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stockLayersService: StockLayersService,
  ) {}

  /**
   * Cria uma change request (fila de câmera).
   */
  async create(dto: CreateChangeRequestDto, tenant: TenantContext, user: AuthenticatedUser) {
    const enrichmentData = (dto.enrichment_data ?? {}) as Record<string, unknown>;

    const changeRequest = await this.prisma.db.stock_change_requests.create({
      data: {
        company_id: tenant.companyId,
        ean: dto.ean,
        enrichment_data: enrichmentData as any,
        requested_by: user.id,
        status: 'pending',
      },
    });

    this.logger.log(
      `Change request criada: id=${changeRequest.id} ean=${dto.ean} company=${tenant.companyId}`,
    );
    return changeRequest;
  }

  /**
   * Lista change requests com filtro e paginação.
   */
  async findAll(tenant: TenantContext, query: QueryChangeRequestsDto) {
    const { status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      company_id: tenant.companyId,
    };

    if (status) {
      where.status = status;
    }

    const [data, total] = await Promise.all([
      this.prisma.db.stock_change_requests.findMany({
        where,
        include: {
          requester: {
            select: { id: true },
          },
          resolver: {
            select: { id: true },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.db.stock_change_requests.count({ where }),
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
   * Aprova uma change request — transação ACID completa.
   *
   * 1. Cria o produto
   * 2. Cria movimentação tipo `in` (primeira entrada)
   * 3. Cria layer FIFO
   * 4. Atualiza stock do produto
   * 5. Atualiza request → confirmed
   */
  async approve(
    id: string,
    dto: ApproveChangeRequestDto,
    tenant: TenantContext,
    user: AuthenticatedUser,
  ) {
    // Verifica existência e status
    const request = await this.prisma.db.stock_change_requests.findFirst({
      where: { id, company_id: tenant.companyId },
    });

    if (!request) {
      throw new NotFoundException(`Change request não encontrada: ${id}`);
    }

    if (request.status !== 'pending') {
      throw new BadRequestException(
        `Change request já foi processada (status: ${request.status}).`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Cria o produto
      const product = await tx.products.create({
        data: {
          company_id: tenant.companyId,
          created_by: user.id,
          sku: dto.sku,
          name: dto.name,
          description: dto.description,
          ncm: dto.ncm,
          barcode: request.ean,
          unit: dto.unit ?? 'UN',
          sale_price: dto.sale_price ?? 0,
          classification_id: dto.classification_id,
          stock: dto.quantity, // Já nasce com o estoque da primeira entrada
        },
      });

      // 2. Cria movimentação tipo `in`
      const movement = await tx.stock_movements.create({
        data: {
          company_id: tenant.companyId,
          product_id: product.id,
          movement_type: 'in',
          quantity: dto.quantity,
          unit_cost: dto.unit_cost,
          reason: 'Primeira entrada via aprovação de change request.',
          performed_by: user.id,
        },
      });

      // 3. Cria layer FIFO
      await this.stockLayersService.createLayer(tx, {
        companyId: tenant.companyId,
        productId: product.id,
        supplierId: dto.supplier_id,
        unitCost: dto.unit_cost,
        quantity: dto.quantity,
      });

      // 4. Atualiza request → confirmed
      await tx.stock_change_requests.update({
        where: { id },
        data: {
          status: 'confirmed',
          resolved_by: user.id,
          resolved_at: new Date(),
        },
      });

      return { product, movement };
    });

    this.logger.log(
      `Change request aprovada: requestId=${id} productId=${result.product.id} company=${tenant.companyId}`,
    );

    return {
      message: 'Change request aprovada. Produto criado com primeira entrada de estoque.',
      product: result.product,
      movement: result.movement,
    };
  }

  /**
   * Rejeita uma change request.
   */
  async reject(id: string, tenant: TenantContext, user: AuthenticatedUser) {
    const request = await this.prisma.db.stock_change_requests.findFirst({
      where: { id, company_id: tenant.companyId },
    });

    if (!request) {
      throw new NotFoundException(`Change request não encontrada: ${id}`);
    }

    if (request.status !== 'pending') {
      throw new BadRequestException(
        `Change request já foi processada (status: ${request.status}).`,
      );
    }

    await this.prisma.db.stock_change_requests.update({
      where: { id },
      data: {
        status: 'rejected',
        resolved_by: user.id,
        resolved_at: new Date(),
      },
    });

    this.logger.log(`Change request rejeitada: id=${id} company=${tenant.companyId}`);
    return { message: 'Change request rejeitada.' };
  }
}
