import type { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { env } from '../config/env';

const message = (text: string) => ({ error: { code: 'RATE_LIMITED', message: text } });
const testMultiplier = env.NODE_ENV === 'test' ? 1000 : 1;

/** Criação de pagamentos (pedidos, doações, apadrinhamento): 20/min por IP. */
export const paymentLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20 * testMultiplier,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('Muitas tentativas de pagamento. Aguarde um minuto.'),
});

/** Formulários públicos (adoção, chamados): 10/min por IP. */
export const formLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10 * testMultiplier,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('Muitos envios em sequência. Aguarde um minuto.'),
});

/** API pública: 60/min por chave de parceiro (configurável nos testes). */
export function publicApiLimiter(limit = 60) {
  return rateLimit({
    windowMs: 60_000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req: Request) => req.partner?.id ?? ipKeyGenerator(req.ip ?? ''),
    message: message(
      'Limite de requisições da API pública excedido (60/min). Tente novamente em instantes.',
    ),
  });
}
