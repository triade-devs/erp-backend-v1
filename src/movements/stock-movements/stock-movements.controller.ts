import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { StockMovementsService } from './stock-movements.service.js';
import { CreateMovementDto } from './dto/create-movement.dto.js';
import { QueryMovementsDto } from './dto/query-movements.dto.js';
import { TenantProtected } from '../../common/decorators/tenant-protected.decorator.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { TenantContext, AuthenticatedUser } from '../../common/interfaces/request-context.interface.js';

/**
 * StockMovementsController — Endpoints de movimentação de estoque.
 *
 * module_code: movements
 * Único POST para os 4 tipos de movimentação (in, out, adjustment, loss).
 */
@ApiTags('Movements (Movimentações)')
@ApiBearerAuth('supabase-jwt')
@ApiSecurity('company-id')
@TenantProtected()
@Controller('movements')
export class StockMovementsController {
  constructor(private readonly stockMovementsService: StockMovementsService) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /movements — Criar movimentação
  // ─────────────────────────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('movements:movement:create')
  @ApiOperation({
    summary: 'Criar movimentação de estoque',
    description:
      'Endpoint unificado para os 4 tipos de movimentação:\n\n' +
      '| Tipo | Comportamento | `unit_cost` | `reason` |\n' +
      '|---|---|---|---|\n' +
      '| `in` | Cria lote (layer) FIFO | **Obrigatório** | Opcional |\n' +
      '| `adjustment` | Cria lote (ajuste positivo) | **Obrigatório** | Opcional |\n' +
      '| `out` | Consome FIFO (mais antigo primeiro) | Ignorado | Opcional |\n' +
      '| `loss` | Consome FIFO (perda) | Ignorado | **Obrigatório** |\n\n' +
      'Toda operação é ACID — roda em transação única.\n' +
      'Furo de estoque retorna `400` com mensagem descritiva.',
  })
  @ApiResponse({ status: 201, description: 'Movimentação criada com sucesso.' })
  @ApiResponse({
    status: 400,
    description:
      'Dados inválidos, campo obrigatório ausente ou furo de integridade (saldo insuficiente).',
  })
  @ApiResponse({ status: 404, description: 'Produto não encontrado.' })
  async create(
    @Body() dto: CreateMovementDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.stockMovementsService.create(dto, tenant, user);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /movements — Listagem paginada com filtros
  // ─────────────────────────────────────────────────────────────────────────────

  @Get()
  @RequirePermission('movements:movement:read')
  @ApiOperation({
    summary: 'Listar movimentações',
    description:
      'Retorna lista paginada de movimentações da empresa.\n' +
      'Filtros: `product_id`, `movement_type`, range de datas.',
  })
  @ApiResponse({ status: 200, description: 'Lista de movimentações retornada.' })
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: QueryMovementsDto,
  ) {
    return this.stockMovementsService.findAll(tenant, query);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /movements/:id — Detalhe (com consumo por lote)
  // ─────────────────────────────────────────────────────────────────────────────

  @Get(':id')
  @RequirePermission('movements:movement:read')
  @ApiOperation({
    summary: 'Detalhe da movimentação',
    description:
      'Retorna dados completos da movimentação, incluindo `movement_layer_consumption` ' +
      '(de quais lotes saiu e a que custo unitário).',
  })
  @ApiParam({ name: 'id', description: 'UUID da movimentação.', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Movimentação encontrada.' })
  @ApiResponse({ status: 404, description: 'Movimentação não encontrada.' })
  async findOne(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.stockMovementsService.findOne(id, tenant);
  }
}
