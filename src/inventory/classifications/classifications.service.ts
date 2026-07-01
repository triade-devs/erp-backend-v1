import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateClassificationDto } from './dto/create-classification.dto.js';
import type { UpdateClassificationDto } from './dto/update-classification.dto.js';
import type { TenantContext } from '../../common/interfaces/request-context.interface.js';

/**
 * Mapa de validação de hierarquia: qual level o pai deve ter para cada level filho.
 */
const PARENT_LEVEL_MAP: Record<string, { requiresParent: boolean; parentLevel?: string }> = {
  department: { requiresParent: false },
  category: { requiresParent: true, parentLevel: 'department' },
  brand: { requiresParent: true, parentLevel: 'category' },
};

/**
 * ClassificationsService — Árvore de classificações de produto (3 níveis).
 *
 * Hierarquia validada em código antes de qualquer insert:
 * - department: raiz, sem pai
 * - category: pai deve ser department da mesma empresa
 * - brand: pai deve ser category da mesma empresa
 */
@Injectable()
export class ClassificationsService {
  private readonly logger = new Logger(ClassificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista todas as classificações da empresa (árvore flat).
   */
  async findAll(tenant: TenantContext) {
    return this.prisma.db.product_classifications.findMany({
      where: { company_id: tenant.companyId },
      orderBy: [{ level: 'asc' }, { sort_order: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Cria uma nova classificação validando hierarquia.
   */
  async create(dto: CreateClassificationDto, tenant: TenantContext) {
    const rule = PARENT_LEVEL_MAP[dto.level];

    if (!rule) {
      throw new BadRequestException(`Level inválido: ${dto.level}. Use: department, category ou brand.`);
    }

    // ── Validação de hierarquia ──
    if (rule.requiresParent) {
      if (!dto.parent_id) {
        throw new BadRequestException(
          `Classificações do tipo "${dto.level}" exigem um parent_id (pai do tipo "${rule.parentLevel}").`,
        );
      }

      const parent = await this.prisma.db.product_classifications.findFirst({
        where: {
          id: dto.parent_id,
          company_id: tenant.companyId,
        },
      });

      if (!parent) {
        throw new BadRequestException(
          `Classificação pai não encontrada: ${dto.parent_id}. Verifique se pertence à sua empresa.`,
        );
      }

      if (parent.level !== rule.parentLevel) {
        throw new BadRequestException(
          `Classificação do tipo "${dto.level}" deve ter pai do tipo "${rule.parentLevel}", ` +
            `mas o pai informado é do tipo "${parent.level}".`,
        );
      }
    } else {
      // department não pode ter parent_id
      if (dto.parent_id) {
        throw new BadRequestException(
          'Classificações do tipo "department" são raiz e não devem ter parent_id.',
        );
      }
    }

    const classification = await this.prisma.db.product_classifications.create({
      data: {
        company_id: tenant.companyId,
        name: dto.name,
        level: dto.level,
        parent_id: dto.parent_id ?? null,
        sort_order: dto.sort_order ?? 0,
      },
    });

    this.logger.log(
      `Classificação criada: id=${classification.id} level=${dto.level} company=${tenant.companyId}`,
    );
    return classification;
  }

  /**
   * Atualiza nome e/ou sort_order de uma classificação.
   */
  async update(id: string, dto: UpdateClassificationDto, tenant: TenantContext) {
    const existing = await this.prisma.db.product_classifications.findFirst({
      where: { id, company_id: tenant.companyId },
    });

    if (!existing) {
      throw new NotFoundException(`Classificação não encontrada: ${id}`);
    }

    const classification = await this.prisma.db.product_classifications.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.sort_order !== undefined && { sort_order: dto.sort_order }),
      },
    });

    this.logger.log(`Classificação atualizada: id=${id} company=${tenant.companyId}`);
    return classification;
  }

  /**
   * Exclusão física com guarda: só executa se não existir nenhum produto vinculado.
   *
   * Verifica também nos filhos da classificação (cascata na árvore).
   */
  async remove(id: string, tenant: TenantContext) {
    const existing = await this.prisma.db.product_classifications.findFirst({
      where: { id, company_id: tenant.companyId },
    });

    if (!existing) {
      throw new NotFoundException(`Classificação não encontrada: ${id}`);
    }

    // Coleta todos os IDs da subárvore (o nó + todos os seus descendentes)
    const subtreeIds = await this.collectSubtreeIds(id, tenant.companyId);

    // Verifica se algum produto referencia algum nó da subárvore
    const productCount = await this.prisma.db.products.count({
      where: {
        classification_id: { in: subtreeIds },
        company_id: tenant.companyId,
      },
    });

    if (productCount > 0) {
      throw new BadRequestException(
        `Não é possível excluir esta classificação: ${productCount} produto(s) estão vinculados ` +
          'a ela ou aos seus filhos. Reclassifique os produtos antes de excluir.',
      );
    }

    // Exclusão em cascata (o schema define onDelete: Cascade para parent_id)
    await this.prisma.db.product_classifications.delete({ where: { id } });

    this.logger.log(`Classificação excluída: id=${id} company=${tenant.companyId}`);
    return { message: 'Classificação excluída com sucesso.' };
  }

  /**
   * Coleta recursivamente todos os IDs da subárvore de uma classificação.
   */
  private async collectSubtreeIds(rootId: string, companyId: string): Promise<string[]> {
    const ids = [rootId];

    const children = await this.prisma.db.product_classifications.findMany({
      where: { parent_id: rootId, company_id: companyId },
      select: { id: true },
    });

    for (const child of children) {
      const childIds = await this.collectSubtreeIds(child.id, companyId);
      ids.push(...childIds);
    }

    return ids;
  }
}
