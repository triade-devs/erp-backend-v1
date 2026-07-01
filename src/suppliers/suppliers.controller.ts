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
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { SuppliersService } from './suppliers.service.js';
import { CreateSupplierDto } from './dto/create-supplier.dto.js';
import { UpdateSupplierDto } from './dto/update-supplier.dto.js';
import { QuerySuppliersDto } from './dto/query-suppliers.dto.js';
import { TenantProtected } from '../common/decorators/tenant-protected.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { TenantContext, AuthenticatedUser } from '../common/interfaces/request-context.interface.js';

/**
 * SuppliersController — CRUD de fornecedores.
 *
 * module_code: suppliers
 * Todas as rotas exigem @TenantProtected() + permission do módulo suppliers.
 */
@ApiTags('Suppliers (Fornecedores)')
@ApiBearerAuth('supabase-jwt')
@ApiSecurity('company-id')
@TenantProtected()
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /suppliers — Listagem paginada
  // ─────────────────────────────────────────────────────────────────────────────

  @Get()
  @RequirePermission('suppliers:supplier:read')
  @ApiOperation({
    summary: 'Listar fornecedores',
    description:
      'Retorna lista paginada de fornecedores da empresa.\n' +
      'Suporta busca por nome (case-insensitive).',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de fornecedores retornada com sucesso.',
  })
  @ApiResponse({ status: 401, description: 'JWT ausente ou inválido.' })
  @ApiResponse({ status: 403, description: 'Sem permissão `suppliers:supplier:read`.' })
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: QuerySuppliersDto,
  ) {
    return this.suppliersService.findAll(tenant, query);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /suppliers/enrich/cnpj/:cnpj — Autopreenchimento por CNPJ
  // ─────────────────────────────────────────────────────────────────────────────

  @Get('enrich/cnpj/:cnpj')
  @RequirePermission('suppliers:supplier:create', 'suppliers:supplier:update')
  @ApiOperation({
    summary: 'Enriquecer dados por CNPJ (autopreenchimento)',
    description:
      'Consulta o microserviço de enriquecimento para autopreenchimento do formulário.\n' +
      'Retorna os dados da empresa ou `{}` se indisponível.\n' +
      'Nunca persiste diretamente — o front usa para preencher o form antes do POST.',
  })
  @ApiParam({
    name: 'cnpj',
    description: 'CNPJ da empresa a consultar (com ou sem formatação).',
    example: '12345678000190',
  })
  @ApiResponse({
    status: 200,
    description: 'Dados de enriquecimento retornados (ou `{}` se indisponível).',
  })
  async enrichByCnpj(@Param('cnpj') cnpj: string) {
    return this.suppliersService.enrichByCnpj(cnpj);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /suppliers/:id — Detalhe
  // ─────────────────────────────────────────────────────────────────────────────

  @Get(':id')
  @RequirePermission('suppliers:supplier:read')
  @ApiOperation({
    summary: 'Detalhe do fornecedor',
    description: 'Retorna os dados completos de um fornecedor por UUID.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do fornecedor.',
    format: 'uuid',
  })
  @ApiResponse({ status: 200, description: 'Fornecedor encontrado.' })
  @ApiResponse({ status: 404, description: 'Fornecedor não encontrado.' })
  async findOne(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.suppliersService.findOne(id, tenant);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /suppliers — Criar fornecedor
  // ─────────────────────────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('suppliers:supplier:create')
  @ApiOperation({
    summary: 'Criar fornecedor',
    description: 'Cria um novo fornecedor vinculado à empresa do tenant.',
  })
  @ApiResponse({ status: 201, description: 'Fornecedor criado com sucesso.' })
  @ApiResponse({ status: 400, description: 'Dados inválidos.' })
  async create(
    @Body() dto: CreateSupplierDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.suppliersService.create(dto, tenant, user);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PATCH /suppliers/:id — Atualizar fornecedor
  // ─────────────────────────────────────────────────────────────────────────────

  @Patch(':id')
  @RequirePermission('suppliers:supplier:update')
  @ApiOperation({
    summary: 'Atualizar fornecedor',
    description: 'Atualiza parcialmente os dados de um fornecedor.',
  })
  @ApiParam({ name: 'id', description: 'UUID do fornecedor.', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Fornecedor atualizado.' })
  @ApiResponse({ status: 404, description: 'Fornecedor não encontrado.' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.suppliersService.update(id, dto, tenant);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DELETE /suppliers/:id — Soft-delete
  // ─────────────────────────────────────────────────────────────────────────────

  @Delete(':id')
  @RequirePermission('suppliers:supplier:delete')
  @ApiOperation({
    summary: 'Desativar fornecedor (soft-delete)',
    description:
      'Marca o fornecedor como `is_active: false`.\n' +
      'Não existe exclusão física — fornecedor está referenciado em `stock_layers` (FK).',
  })
  @ApiParam({ name: 'id', description: 'UUID do fornecedor.', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Fornecedor desativado.' })
  @ApiResponse({ status: 400, description: 'Fornecedor já está desativado.' })
  @ApiResponse({ status: 404, description: 'Fornecedor não encontrado.' })
  async softDelete(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.suppliersService.softDelete(id, tenant);
  }
}
