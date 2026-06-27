import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller.js';
import { OnboardingService } from './onboarding.service.js';

/**
 * OnboardingModule — Módulo das três portas de entrada no sistema.
 *
 * Expõe os endpoints de criação de empresa, dados fiscais e aceite de convite.
 * Não depende do PrismaModule diretamente pois é global (PrismaModule é global).
 */
@Module({
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}