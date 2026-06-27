/**
 * Permissões fixas concedidas a operadores de suporte em modo proxy.
 *
 * Decisão #3 do plano: conjunto fixo via constante — não acesso total.
 * Operadores de suporte recebem leitura ampla + um conjunto pequeno de
 * ações de escrita. Expandido sob demanda real, nunca aberto de antemão.
 *
 * Para adicionar uma permissão de suporte: adicione o código aqui e
 * abra uma PR documentando o motivo operacional.
 */
export const SUPPORT_PROXY_PERMISSIONS: string[] = [
  // ── Leitura ampla ──────────────────────────────────────────────
  'companies.read',
  'memberships.read',
  'roles.read',
  'permissions.read',

  // Produtos e estoque (somente leitura)
  'products.read',
  'suppliers.read',
  'stock.read',
  'stock_movements.read',
  'stock_layers.read',

  // Auditoria (somente leitura — para diagnosticar problemas)
  'audit_logs.read',

  // ── Ações de escrita limitadas ────────────────────────────────
  // Nenhuma por padrão. Adicionar conforme necessidade operacional documentada.
];
