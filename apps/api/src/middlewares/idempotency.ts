import type { Request } from 'express';
import { AppError } from '../lib/errors';

/**
 * Lê o header Idempotency-Key (opcional). Quando ausente, o service gera uma chave própria
 * — o gateway sempre recebe uma chave de idempotência.
 */
export function readIdempotencyKey(req: Request): string | undefined {
  const key = req.header('idempotency-key');
  if (key === undefined) return undefined;
  if (!/^[\w-]{8,100}$/.test(key)) {
    throw AppError.badRequest(
      'Idempotency-Key inválida (use 8 a 100 caracteres: letras, números, - ou _)',
    );
  }
  return key;
}
