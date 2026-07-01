import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EnrichmentService } from '../enrichment/enrichment.service.js';
import type { CreateSupplierDto } from './dto/create-supplier.dto.js';
import type { UpdateSupplierDto } from './dto/update-supplier.dto.js';
import type { QuerySuppliersDto } from './dto/query-suppliers.dto.js';
import type { TenantContext, AuthenticatedUser } from '../common/interfaces/request-context.interface.js';

/**
 * SuppliersService — CRUD de fornecedores com isolamento por tenant.
 *
 * Todo `findMany` filtra por `company_id: tenant.companyId`.
 * DELETE é soft-delete (`is_active: false`).
 */
@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly enrichmentService: EnrichmentService,
  ) {}

  /**
   * Lista fornecedores da empresa com paginação e busca.
   */
  async findAll(tenant: TenantContext, query: QuerySuppliersDto) {
    const { search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where = {
      company_id: tenant.companyId,
      ...(search && {
        name: { contains: search, mode: 'insensitive' as const },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.db.suppliers.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.db.suppliers.count({ where }),
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
   * Retorna um fornecedor por ID (com verificação de tenant).
   */
  async findOne(id: string, tenant: TenantContext) {
    const supplier = await this.prisma.db.suppliers.findFirst({
      where: { id, company_id: tenant.companyId },
    });

    if (!supplier) {
      throw new NotFoundException(`Fornecedor não encontrado: ${id}`);
    }

    return supplier;
  }

  /**
   * Cria um novo fornecedor.
   */
  async create(dto: CreateSupplierDto, tenant: TenantContext, user: AuthenticatedUser) {
    const supplier = await this.prisma.db.suppliers.create({
      data: {
        company_id: tenant.companyId,
        created_by: user.id,
        name: dto.name,
        document: dto.document,
        phone: dto.phone,
        email: dto.email,
        country: dto.country,
        state: dto.state,
        city: dto.city,
        cep: dto.cep,
      },
    });

    this.logger.log(`Fornecedor criado: id=${supplier.id} company=${tenant.companyId}`);
    return supplier;
  }

  /**
   * Atualiza parcialmente um fornecedor.
   */
  async update(id: string, dto: UpdateSupplierDto, tenant: TenantContext) {
    // Verifica existência e ownership
    await this.findOne(id, tenant);

    const supplier = await this.prisma.db.suppliers.update({
      where: { id },
      data: {
        ...dto,
        updated_at: new Date(),
      },
    });

    this.logger.log(`Fornecedor atualizado: id=${id} company=${tenant.companyId}`);
    return supplier;
  }

  /**
   * Soft-delete: marca `is_active: false`.
   * Não exclui fisicamente — fornecedor está referenciado em `stock_layers` (FK).
   */
  async softDelete(id: string, tenant: TenantContext) {
    // Verifica existência e ownership
    const supplier = await this.findOne(id, tenant);

    if (!supplier.is_active) {
      throw new BadRequestException('Fornecedor já está desativado.');
    }

    await this.prisma.db.suppliers.update({
      where: { id },
      data: {
        is_active: false,
        updated_at: new Date(),
      },
    });

    this.logger.log(`Fornecedor desativado (soft-delete): id=${id} company=${tenant.companyId}`);
    return { message: 'Fornecedor desativado com sucesso.' };
  }

  /**
   * Enriquecimento: consulta dados de empresa por CNPJ.
   * Retorna DTO de autopreenchimento ou `{}` em caso de falha.
   */
  async enrichByCnpj(cnpj: string) {
    const result = await this.enrichmentService.lookupEmpresa(cnpj);
    return result ?? {};
  }
}
