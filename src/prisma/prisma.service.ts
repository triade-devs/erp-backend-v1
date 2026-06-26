import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import type { PrismaClient as PrismaClientType } from '../../generated/prisma/index.js';

// O arquivo compilado fica em dist/src/prisma/prisma.service.js
// Em runtime: ../../../generated/prisma → <root>/generated/prisma
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('../../../generated/prisma') as {
  PrismaClient: new (options?: ConstructorParameters<typeof PrismaClientType>[0]) => PrismaClientType;
};

export type { PrismaClientType as PrismaClient };

/**
 * PrismaService centralizado e global.
 *
 * Responsabilidades:
 * 1. Gerenciar o ciclo de vida da conexão ($connect / $disconnect)
 * 2. Expor o client estendido com query extensions para RLS context
 *    (implementação real do tenant filtering virá na Fase 3)
 * 3. Fornecer helpers transacionais utilizados pelo motor FIFO (Fase 5)
 *
 * Arquitetura: Composição em vez de herança para compatibilidade com
 * module: nodenext e o path customizado do output do Prisma.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly client: PrismaClientType;

  constructor() {
    this.client = new PrismaClient({
      log: [
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Conectando ao PostgreSQL…');
    await this.client.$connect();
    this.logger.log('Conexão estabelecida com sucesso ✓');
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Desconectando do PostgreSQL…');
    await this.client.$disconnect();
    this.logger.log('Conexão encerrada ✓');
  }

  /**
   * Expõe o PrismaClient tipado para os services injetarem.
   * Permite acessar todos os modelos: this.prisma.client.products, etc.
   */
  get db(): PrismaClientType {
    return this.client;
  }

  /**
   * Atalho para transações — delega ao client interno.
   * @example
   * await this.prisma.$transaction(async (tx) => { ... })
   */
  get $transaction(): PrismaClientType['$transaction'] {
    return this.client.$transaction.bind(this.client);
  }

  /**
   * Atalho para raw queries — delega ao client interno.
   */
  get $queryRaw(): PrismaClientType['$queryRaw'] {
    return this.client.$queryRaw.bind(this.client);
  }

  /**
   * Atalho para raw executes — delega ao client interno.
   */
  get $executeRaw(): PrismaClientType['$executeRaw'] {
    return this.client.$executeRaw.bind(this.client);
  }

  /**
   * Placeholder para RLS tenant context (Fase 3).
   * Retornará um client estendido com SET app.current_company_id.
   */
  forTenant(_companyId: string): PrismaClientType {
    // TODO Fase 3: $extends com query middleware para RLS
    return this.client;
  }
}
