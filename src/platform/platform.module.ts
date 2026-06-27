import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller.js';
import { PlatformService } from './platform.service.js';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard.js';

/**
 * PlatformModule — Módulo de operações administrativas de plataforma.
 *
 * Expõe endpoints de gestão da plataforma (support grants, etc.).
 * Acesso restrito a platform_admins.
 */
@Module({
  controllers: [PlatformController],
  providers: [PlatformService, PlatformAdminGuard],
})
export class PlatformModule {}