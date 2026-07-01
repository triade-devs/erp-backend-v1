import {
  Body,
  Controller,
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
  ApiQuery,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ProductsService } from './products.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { QueryProductsDto } from './dto/query-products.dto.js';
import { TenantProtected } from '../../common/decorators/tenant-protected.decorator.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { TenantContext, AuthenticatedUser } from '../../common/interfaces/request-context.interface.js';

/**
 * ProductsController — CRUD de produtos.
 *
 * Subdomínio de InventoryModule. Usa permissions do módulo inventory.
 */
@ApiTags('Inventory - Products')
@ApiBearerAuth('supabase-jwt')
@ApiSecurity('company-id')
@TenantProtected()
@Controller('inventory/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /inventory/products — Listagem paginada
  // ─────────────────────────────────────────────────────────────────────────────

  @Get()
  @RequirePermission('inventory:product:read')
  @ApiOperation({
    summary: 'Listar produtos',
    description:
      'Retorna lista paginada de produtos da empresa.\n' +
      'Suporta busca por nome/SKU, filtro por classificação e status.',
  })
  @ApiResponse({ status: 200, description: 'Lista de produtos retornada.' })
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: QueryProductsDto,
  ) {
    return this.productsService.findAll(tenant, query);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /inventory/products/enrich/barcode/:ean — Enriquecimento por EAN
  // ─────────────────────────────────────────────────────────────────────────────

  @Get('enrich/barcode/:ean')
  @RequirePermission('inventory:product:create', 'inventory:product:update')
  @ApiOperation({
    summary: 'Enriquecer dados por EAN (autopreenchimento)',
    description:
      'Consulta o microserviço de barcode para autopreenchimento do formulário.\n' +
      'Retorna dados do produto ou `{}` se indisponível.',
  })
  @ApiParam({
    name: 'ean',
    description: 'Código EAN/GTIN do produto.',
    example: '7891234567890',
  })
  @ApiResponse({ status: 200, description: 'Dados de enriquecimento retornados.' })
  async enrichByBarcode(@Param('ean') ean: string) {
    return this.productsService.enrichByBarcode(ean);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /inventory/products/enrich/ncm — Autocomplete de NCM
  // ─────────────────────────────────────────────────────────────────────────────

  @Get('enrich/ncm')
  @RequirePermission('inventory:product:create', 'inventory:product:update')
  @ApiOperation({
    summary: 'Autocomplete de NCM',
    description:
      'Consulta o microserviço de NCM para autocomplete do campo.\n' +
      'Retorna lista de NCMs ou `[]` se indisponível.',
  })
  @ApiQuery({
    name: 'q',
    description: 'Texto de busca para NCM.',
    example: '8471',
  })
  @ApiResponse({ status: 200, description: 'Lista de NCMs retornada.' })
  async enrichNcm(@Query('q') q: string) {
    return this.productsService.enrichNcm(q ?? '');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /inventory/products/:id — Detalhe
  // ─────────────────────────────────────────────────────────────────────────────

  @Get(':id')
  @RequirePermission('inventory:product:read')
  @ApiOperation({
    summary: 'Detalhe do produto',
    description: 'Retorna dados completos de um produto por UUID, incluindo classificação.',
  })
  @ApiParam({ name: 'id', description: 'UUID do produto.', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Produto encontrado.' })
  @ApiResponse({ status: 404, description: 'Produto não encontrado.' })
  async findOne(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.productsService.findOne(id, tenant);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /inventory/products — Criar produto
  // ─────────────────────────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('inventory:product:create')
  @ApiOperation({
    summary: 'Criar produto',
    description:
      'Cria um novo produto vinculado à empresa.\n\n' +
      '- `stock` nasce `0` automaticamente (default do schema).\n' +
      '- `classification_id` é opcional — quando presente, valida que pertence à empresa.',
  })
  @ApiResponse({ status: 201, description: 'Produto criado.' })
  @ApiResponse({ status: 400, description: 'Dados inválidos ou classificação inexistente.' })
  @ApiResponse({ status: 409, description: 'SKU já existe nesta empresa.' })
  async create(
    @Body() dto: CreateProductDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.productsService.create(dto, tenant, user);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PATCH /inventory/products/:id — Atualizar produto
  // ─────────────────────────────────────────────────────────────────────────────

  @Patch(':id')
  @RequirePermission('inventory:product:update')
  @ApiOperation({
    summary: 'Atualizar produto',
    description:
      'Atualiza parcialmente um produto.\n\n' +
      '**Efeito colateral**: quando `sale_price` muda, insere automaticamente ' +
      'uma linha em `sale_price_history` na mesma transação.',
  })
  @ApiParam({ name: 'id', description: 'UUID do produto.', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Produto atualizado.' })
  @ApiResponse({ status: 404, description: 'Produto não encontrado.' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.productsService.update(id, dto, tenant, user);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PATCH /inventory/products/:id/deactivate — Desativar
  // ─────────────────────────────────────────────────────────────────────────────

  @Patch(':id/deactivate')
  @RequirePermission('inventory:product:delete')
  @ApiOperation({
    summary: 'Desativar produto',
    description: 'Marca o produto como `is_active: false`. Equivale a um soft-delete.',
  })
  @ApiParam({ name: 'id', description: 'UUID do produto.', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Produto desativado.' })
  @ApiResponse({ status: 400, description: 'Produto já está desativado.' })
  @ApiResponse({ status: 404, description: 'Produto não encontrado.' })
  async deactivate(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.productsService.deactivate(id, tenant);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PATCH /inventory/products/:id/reactivate — Reativar
  // ─────────────────────────────────────────────────────────────────────────────

  @Patch(':id/reactivate')
  @RequirePermission('inventory:product:update')
  @ApiOperation({
    summary: 'Reativar produto',
    description: 'Marca o produto como `is_active: true`.',
  })
  @ApiParam({ name: 'id', description: 'UUID do produto.', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Produto reativado.' })
  @ApiResponse({ status: 400, description: 'Produto já está ativo.' })
  @ApiResponse({ status: 404, description: 'Produto não encontrado.' })
  async reactivate(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.productsService.reactivate(id, tenant);
  }
}
