import type { CompanySetupStatus } from '../../../generated/prisma/index.js';

/**
 * Payload extraído do JWT do Supabase Auth após validação.
 * Todos os guards e decorators do sistema operam sobre esta interface.
 */
export interface AuthenticatedUser {
  /** UUID do usuário no auth.users (sub do JWT) */
  id: string;

  /** E-mail do JWT */
  email: string;

  /** Metadata vinda do raw_app_meta_data (ex: provider) */
  appMetadata?: Record<string, unknown>;

  /**
   * Authenticator Assurance Level do Supabase Auth.
   * 'aal1' = senha simples | 'aal2' = MFA verificado.
   * Extraído do claim `aal` do JWT (Fase C/F).
   */
  aal?: 'aal1' | 'aal2';

  /** Se true, este request vem de um operador de suporte acessando tenant alheio */
  isSupportProxy?: boolean;

  /** Quando isSupportProxy = true, indica o company_id real sendo acessado */
  realCompanyId?: string;
}

/**
 * Contexto de tenant resolvido pelo TenantGuard.
 * Injetado no request para os controllers e services consumirem.
 */
export interface TenantContext {
  /** UUID da empresa ativa no request */
  companyId: string;

  /** UUID do membership do usuário nesta empresa */
  membershipId: string;

  /** Códigos de permissão do usuário nesta empresa (ex: ['inventory.read', 'inventory.write']) */
  permissions: string[];

  /**
   * Status de setup da empresa, carregado pelo TenantGuard junto com o membership.
   * Usado pelo CompanyActiveGuard para decidir bloqueio 423/403.
   */
  setupStatus: CompanySetupStatus;
}

export type { CompanySetupStatus };

