import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/index.js';

/**
 * PrismaService centralizado e global.
 *
 * Responsabilidades:
 * 1. Gerenciar o ciclo de vida da conexão ($connect / $disconnect)
 * 2. Expor o client estendido com query extensions para RLS context
 *    (implementação real do tenant filtering virá na Fase 3)
 * 3. Fornecer helpers transacionais utilizados pelo motor FIFO (Fase 5)
 *
 * NOTA: O Prisma v6 com output customizado em `generated/prisma`
 * exige import direto do path gerado.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Conectando ao PostgreSQL…');
    await this.$connect();
    this.logger.log('Conexão estabelecida com sucesso ✓');
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Desconectando do PostgreSQL…');
    await this.$disconnect();
    this.logger.log('Conexão encerrada ✓');
  }

  /**
   * Placeholder para a extensão de RLS via middleware (Fase 3).
   * Quando implementado, este método retornará um client estendido
   * que injeta `SET app.current_company_id = ?` em cada transação.
   */
  forTenant(_companyId: string): PrismaClient {
    // TODO Fase 3: implementar $extends com query middleware
    // que executa SET local na transação para ativar RLS policies.
    return this;
  }
}
