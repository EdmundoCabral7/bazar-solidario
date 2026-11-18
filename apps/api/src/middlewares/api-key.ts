import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';

export const hashApiKey = (key: string) => createHash('sha256').update(key).digest('hex');

/** Autenticação da API pública por header x-api-key (armazenada como hash SHA-256). */
export const requireApiKey: RequestHandler = async (req, _res, next) => {
  const key = req.header('x-api-key');
  if (!key)
    return next(new AppError(401, 'API_KEY_REQUIRED', 'Informe a chave no header x-api-key'));
  const partner = await prisma.partner.findUnique({ where: { apiKeyHash: hashApiKey(key) } });
  if (!partner || !partner.active) {
    return next(new AppError(401, 'INVALID_API_KEY', 'Chave de API inválida ou revogada'));
  }
  req.partner = { id: partner.id, name: partner.name };
  // registro de uso sem bloquear a resposta
  prisma.partner
    .update({ where: { id: partner.id }, data: { lastUsedAt: new Date() } })
    .catch((err) => logger.warn({ err }, 'falha ao registrar uso da API key'));
  next();
};
