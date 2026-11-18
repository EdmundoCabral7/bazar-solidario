import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter pelo menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  INTEGRATIONS_MODE: z.enum(['mock', 'sandbox']).default('mock'),
  HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  /** URL pública da API (usada como notification_url dos webhooks). */
  API_PUBLIC_URL: z.string().url().default('http://localhost:3333'),
  /** URL do portal (links em notificações e retorno do checkout). */
  WEB_URL: z.string().url().default('http://localhost:3000'),
  /** ViaCEP é público; 'mock' serve para testes e demonstrações offline. */
  VIACEP_MODE: z.enum(['real', 'mock']).default('real'),
  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),
  /** Segredo da assinatura de webhook. Em mock usa um valor de desenvolvimento. */
  MERCADOPAGO_WEBHOOK_SECRET: z.string().default('dev-webhook-secret'),
  MELHORENVIO_TOKEN: z.string().optional(),
  MELHORENVIO_FROM_CEP: z.string().default('59000000'),
  MELHORENVIO_USER_AGENT: z.string().default('BazarSolidarioDigital (contato@pataspotiguares.org)'),
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  /** Minutos até um pedido com Pix pendente ser cancelado pelo worker. */
  ORDER_PAYMENT_TTL_MINUTES: z.coerce.number().int().positive().default(60),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  // Variáveis vazias no .env contam como não definidas (para valerem os defaults).
  const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ''));
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Variáveis de ambiente inválidas:\n${issues}`);
  }
  const data = parsed.data;
  if (data.INTEGRATIONS_MODE === 'sandbox' && !data.MERCADOPAGO_ACCESS_TOKEN) {
    throw new Error('INTEGRATIONS_MODE=sandbox exige MERCADOPAGO_ACCESS_TOKEN');
  }
  return data;
}

export const env = loadEnv();

/** Lista de origens permitidas no CORS (separadas por vírgula). */
export const corsOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
