import { z } from 'zod';

/**
 * Schema Zod para validação de variáveis de ambiente.
 * O NestJS ConfigModule invoca `validate()` no bootstrap.
 * Se qualquer variável obrigatória estiver faltando, a aplicação NÃO sobe.
 */
export const envSchema = z.object({
  // ── Database ──────────────────────────────────────────────
  DATABASE_URL: z.string().url('DATABASE_URL deve ser uma URL válida de conexão PostgreSQL'),
  DIRECT_URL: z.string().url('DIRECT_URL deve ser uma URL válida de conexão direta').optional(),

  // ── Supabase Auth ─────────────────────────────────────────
  SUPABASE_URL: z.string().url('SUPABASE_URL é obrigatória'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY é obrigatória'),
  SUPABASE_JWT_SECRET: z.string().min(32, 'SUPABASE_JWT_SECRET deve ter pelo menos 32 caracteres'),

  // ── App ───────────────────────────────────────────────────────────────────
  PORT: z
    .string()
    .default('3000')
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().positive()),

  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // ── Platform / Support ────────────────────────────────────────────────────
  /**
   * Quando 'true', exige aal2 (MFA) para criar support grants.
   * Default false — ativar quando platform_admins tiverem MFA configurado no Supabase.
   */
  SUPPORT_MFA_ENFORCED: z
    .enum(['true', 'false'])
    .default('false'),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Função de validação invocada pelo ConfigModule.
 * Lança exceção formatada se as variáveis estiverem inválidas.
 */
export function validate(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `\n❌ Validação de Variáveis de Ambiente falhou:\n${formatted}\n`,
    );
  }

  return result.data;
}
