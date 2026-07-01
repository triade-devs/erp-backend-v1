import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ClassificationsService } from './classifications.service.js';
import { CreateClassificationDto } from './dto/create-classification.dto.js';
import { UpdateClassificationDto } from './dto/update-classification.dto.js';
import { TenantProtected } from '../../common/decorators/tenant-protected.decorator.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator.js';
import type { TenantContext } from '../../common/interfaces/request-context.interface.js';

/**
 * ClassificationsController — CRUD de classificações de produto (árvore 3 níveis).
 *
 * Subdomínio de InventoryModule. Usa permissions do módulo inventory.
 */
@ApiTags('Inventory - Classifications')
@ApiBearerAuth('supabase-jwt')
@ApiSecurity('company-id')
@TenantProtected()
@Controller('inventory/classifications')
export class ClassificationsController {
  constructor(private readonly classificationsService: ClassificationsService) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /inventory/classifications — Listagem da árvore
  // ─────────────────────────────────────────────────────────────────────────────

  @Get()
  @RequirePermission('inventory:product:read')
  @ApiOperation({
    summary: 'Listar classificações',
    description:
      'Retorna todas as classificações da empresa em lista flat.\n' +
      'Hierarquia: department → category → brand.\n' +
      'Use o campo `parent_id` para reconstruir a árvore no frontend.',
  })
  @ApiResponse({ status: 200, description: 'Classificações retornadas.' })
  async findAll(@CurrentTenant() tenant: TenantContext) {
    return this.classificationsService.findAll(tenant);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /inventory/classifications — Criar classificação
  // ─────────────────────────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('inventory:product:create')
  @ApiOperation({
    summary: 'Criar classificação',
    description:
      'Cria uma nova classificação na árvore.\n\n' +
      '**Regras de hierarquia:**\n' +
      '- `department`: raiz, sem `parent_id`.\n' +
      '- `category`: `parent_id` obrigatório, pai deve ser `department`.\n' +
      '- `brand`: `parent_id` obrigatório, pai deve ser `category`.',
  })
  @ApiResponse({ status: 201, description: 'Classificação criada.' })
  @ApiResponse({
    status: 400,
    description: 'Violação de hierarquia ou dados inválidos.',
  })
  async create(
    @Body() dto: CreateClassificationDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.classificationsService.create(dto, tenant);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PATCH /inventory/classifications/:id — Atualizar classificação
  // ─────────────────────────────────────────────────────────────────────────────

  @Patch(':id')
  @RequirePermission('inventory:product:update')
  @ApiOperation({
    summary: 'Atualizar classificação',
    description: 'Atualiza nome e/ou ordem de exibição. Não permite trocar `level` ou `parent_id`.',
  })
  @ApiParam({ name: 'id', description: 'UUID da classificação.', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Classificação atualizada.' })
  @ApiResponse({ status: 404, description: 'Classificação não encontrada.' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateClassificationDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.classificationsService.update(id, dto, tenant);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DELETE /inventory/classifications/:id — Exclusão com guarda
  // ─────────────────────────────────────────────────────────────────────────────

  @Delete(':id')
  @RequirePermission('inventory:product:update')
  @ApiOperation({
    summary: 'Excluir classificação',
    description:
      'Exclusão física **com guarda**: só executa se não existir nenhum produto vinculado ' +
      'ao nó ou aos seus filhos na árvore.\n\n' +
      'Se existirem produtos vinculados, retorna `400` com a contagem.',
  })
  @ApiParam({ name: 'id', description: 'UUID da classificação.', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Classificação excluída.' })
  @ApiResponse({
    status: 400,
    description: 'Existem produtos vinculados — reclassifique antes de excluir.',
  })
  @ApiResponse({ status: 404, description: 'Classificação não encontrada.' })
  async remove(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.classificationsService.remove(id, tenant);
  }
}
