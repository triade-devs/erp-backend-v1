import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

/**
 * Módulo global do Prisma.
 *
 * Ao ser `@Global()`, qualquer módulo da aplicação pode injetar
 * `PrismaService` sem precisar importar `PrismaModule` explicitamente.
 *
 * Esta é a abordagem canônica para projetos NestJS que usam um único
 * banco de dados compartilhado.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
