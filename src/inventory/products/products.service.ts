import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { EnrichmentService } from '../../enrichment/enrichment.service.js';
import type { CreateProductDto } from './dto/create-product.dto.js';
import type { UpdateProductDto } from './dto/update-product.dto.js';
import type { QueryProductsDto } from './dto/query-products.dto.js';
import type { TenantContext, AuthenticatedUser } from '../../common/interfaces/request-context.interface.js';

/**
 * ProductsService — CRUD de produtos com isolamento por tenant.
 *
 * Regras de negócio:
 * - `stock` nasce 0 (default do schema), nunca no DTO.
 * - PATCH com `sale_price`: insere `sale_price_history` na mesma transação.
 * - deactivate/reactivate: soft-toggle `is_active`.
 */
@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly enrichmentService: EnrichmentService,
  ) {}

  /**
   * Lista produtos da empresa com paginação e filtros.
   */
  async findAll(tenant: TenantContext, query: QueryProductsDto) {
    const { search, classification_id, is_active, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      company_id: tenant.companyId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (classification_id) {
      where.classification_id = classification_id;
    }

    if (is_active !== undefined) {
      where.is_active = is_active;
    }

    const [data, total] = await Promise.all([
      this.prisma.db.products.findMany({
        where,
        include: {
          product_classifications: {
            select: { id: true, name: true, level: true },
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.db.products.count({ where }),
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
   * Retorna um produto por ID (com verificação de tenant).
   */
  async findOne(id: string, tenant: TenantContext) {
    const product = await this.prisma.db.products.findFirst({
      where: { id, company_id: tenant.companyId },
      include: {
        product_classifications: {
          select: { id: true, name: true, level: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Produto não encontrado: ${id}`);
    }

    return product;
  }

  /**
   * Cria um novo produto.
   * `stock` nasce 0 pelo default do schema.
   */
  async create(dto: CreateProductDto, tenant: TenantContext, user: AuthenticatedUser) {
    // Valida classification_id se presente
    if (dto.classification_id) {
      await this.validateClassification(dto.classification_id, tenant.companyId);
    }

    try {
      const product = await this.prisma.db.products.create({
        data: {
          company_id: tenant.companyId,
          created_by: user.id,
          sku: dto.sku,
          name: dto.name,
          description: dto.description,
          unit: dto.unit ?? 'UN',
          sale_price: dto.sale_price ?? 0,
          min_stock: dto.min_stock ?? 0,
          ncm: dto.ncm,
          barcode: dto.barcode,
          location: dto.location,
          classification_id: dto.classification_id,
        },
      });

      this.logger.log(`Produto criado: id=${product.id} sku=${dto.sku} company=${tenant.companyId}`);
      return product;
    } catch (error) {
      // Unique constraint violation (company_id, sku)
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException(`Já existe um produto com o SKU "${dto.sku}" nesta empresa.`);
      }
      throw error;
    }
  }

  /**
   * Atualiza parcialmente um produto.
   * Se `sale_price` mudar, insere em `sale_price_history` na mesma transação.
   */
  async update(id: string, dto: UpdateProductDto, tenant: TenantContext, user: AuthenticatedUser) {
    const existing = await this.findOne(id, tenant);

    // Valida classification_id se presente
    if (dto.classification_id) {
      await this.validateClassification(dto.classification_id, tenant.companyId);
    }

    const salePriceChanged =
      dto.sale_price !== undefined && Number(existing.sale_price) !== dto.sale_price;

    if (salePriceChanged) {
      // Transação: update produto + insert price history
      const [product] = await this.prisma.$transaction([
        this.prisma.db.products.update({
          where: { id },
          data: {
            ...dto,
            updated_at: new Date(),
          },
        }),
        this.prisma.db.sale_price_history.create({
          data: {
            product_id: id,
            price: dto.sale_price!,
            changed_by: user.id,
          },
        }),
      ]);

      this.logger.log(
        `Produto atualizado com histórico de preço: id=${id} newPrice=${dto.sale_price}`,
      );
      return product;
    }

    const product = await this.prisma.db.products.update({
      where: { id },
      data: {
        ...dto,
        updated_at: new Date(),
      },
    });

    this.logger.log(`Produto atualizado: id=${id} company=${tenant.companyId}`);
    return product;
  }

  /**
   * Desativa produto (soft-delete).
   * Permission: `inventory:product:delete`
   */
  async deactivate(id: string, tenant: TenantContext) {
    const product = await this.findOne(id, tenant);

    if (!product.is_active) {
      throw new BadRequestException('Produto já está desativado.');
    }

    await this.prisma.db.products.update({
      where: { id },
      data: { is_active: false, updated_at: new Date() },
    });

    this.logger.log(`Produto desativado: id=${id} company=${tenant.companyId}`);
    return { message: 'Produto desativado com sucesso.' };
  }

  /**
   * Reativa produto.
   * Permission: `inventory:product:update`
   */
  async reactivate(id: string, tenant: TenantContext) {
    const product = await this.findOne(id, tenant);

    if (product.is_active) {
      throw new BadRequestException('Produto já está ativo.');
    }

    await this.prisma.db.products.update({
      where: { id },
      data: { is_active: true, updated_at: new Date() },
    });

    this.logger.log(`Produto reativado: id=${id} company=${tenant.companyId}`);
    return { message: 'Produto reativado com sucesso.' };
  }

  /**
   * Enriquecimento: consulta dados de produto por EAN.
   */
  async enrichByBarcode(ean: string) {
    const result = await this.enrichmentService.lookupBarcode(ean);
    return result ?? {};
  }

  /**
   * Enriquecimento: autocomplete de NCM.
   */
  async enrichNcm(q: string) {
    return this.enrichmentService.lookupNcm(q);
  }

  /**
   * Valida que a classificação existe e pertence à mesma empresa.
   */
  private async validateClassification(classificationId: string, companyId: string) {
    const classification = await this.prisma.db.product_classifications.findFirst({
      where: { id: classificationId, company_id: companyId },
    });

    if (!classification) {
      throw new BadRequestException(
        `Classificação não encontrada: ${classificationId}. Verifique se pertence à sua empresa.`,
      );
    }
  }
}
