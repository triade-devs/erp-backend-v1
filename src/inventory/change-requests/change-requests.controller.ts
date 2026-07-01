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
import { ChangeRequestsService } from './change-requests.service.js';
import { CreateChangeRequestDto } from './dto/create-change-request.dto.js';
import { ApproveChangeRequestDto } from './dto/approve-change-request.dto.js';
import { QueryChangeRequestsDto } from './dto/query-change-requests.dto.js';
import { TenantProtected } from '../../common/decorators/tenant-protected.decorator.js';
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { TenantContext, AuthenticatedUser } from '../../common/interfaces/request-context.interface.js';

/**
 * ChangeRequestsController — Fila de câmera para cadastro de produtos.
 *
 * Subdomínio de InventoryModule.
 * Usa permissions mistas: movements:movement:create para criação (operador),
 * inventory:product:create/read para listagem e aprovação (gerente).
 */
@ApiTags('Inventory - Change Requests')
@ApiBearerAuth('supabase-jwt')
@ApiSecurity('company-id')
@TenantProtected()
@Controller('inventory/change-requests')
export class ChangeRequestsController {
  constructor(private readonly changeRequestsService: ChangeRequestsService) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /inventory/change-requests — Criar request (operador)
  // ─────────────────────────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('movements:movement:create')
  @ApiOperation({
    summary: 'Criar change request (fila de câmera)',
    description:
      'Operador lê o EAN pela câmera e submete uma request para cadastro de novo produto.\n\n' +
      'Permission: `movements:movement:create` — o operador não tem `inventory:product:create`, ' +
      'usa o de movimentação como proxy de intenção.\n\n' +
      'A request nasce com `status: "pending"` e aguarda aprovação do gerente.',
  })
  @ApiResponse({ status: 201, description: 'Change request criada com status pending.' })
  @ApiResponse({ status: 400, description: 'Dados inválidos.' })
  async create(
    @Body() dto: CreateChangeRequestDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.changeRequestsService.create(dto, tenant, user);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /inventory/change-requests — Listagem (gerente)
  // ─────────────────────────────────────────────────────────────────────────────

  @Get()
  @RequirePermission('inventory:product:read')
  @ApiOperation({
    summary: 'Listar change requests',
    description:
      'Retorna lista paginada de change requests da empresa.\n' +
      'Filtrável por status: `pending`, `confirmed`, `rejected`.',
  })
  @ApiResponse({ status: 200, description: 'Lista de change requests retornada.' })
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: QueryChangeRequestsDto,
  ) {
    return this.changeRequestsService.findAll(tenant, query);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /inventory/change-requests/:id/approve — Aprovar (gerente)
  // ─────────────────────────────────────────────────────────────────────────────

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('inventory:product:create')
  @ApiOperation({
    summary: 'Aprovar change request',
    description:
      'Gerente aprova a request — transação ACID:\n\n' +
      '1. Cria o produto com os dados fornecidos.\n' +
      '2. Cria movimentação tipo `in` (primeira entrada).\n' +
      '3. Cria layer FIFO com `unit_cost` do DTO.\n' +
      '4. Atualiza o stock do produto.\n' +
      '5. Marca a request como `confirmed`.',
  })
  @ApiParam({ name: 'id', description: 'UUID da change request.', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Request aprovada. Produto criado com primeira entrada de estoque.',
  })
  @ApiResponse({ status: 400, description: 'Request já processada ou dados inválidos.' })
  @ApiResponse({ status: 404, description: 'Change request não encontrada.' })
  async approve(
    @Param('id') id: string,
    @Body() dto: ApproveChangeRequestDto,
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.changeRequestsService.approve(id, dto, tenant, user);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /inventory/change-requests/:id/reject — Rejeitar (gerente)
  // ─────────────────────────────────────────────────────────────────────────────

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('inventory:product:create')
  @ApiOperation({
    summary: 'Rejeitar change request',
    description: 'Gerente rejeita a request — marca como `rejected` com `resolved_by` e `resolved_at`.',
  })
  @ApiParam({ name: 'id', description: 'UUID da change request.', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Request rejeitada.' })
  @ApiResponse({ status: 400, description: 'Request já processada.' })
  @ApiResponse({ status: 404, description: 'Change request não encontrada.' })
  async reject(
    @Param('id') id: string,
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.changeRequestsService.reject(id, tenant, user);
  }
}
