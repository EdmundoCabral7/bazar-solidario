import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import type { ApiErrorBody } from '@bazar/shared';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Rota ${req.method} ${req.path} não encontrada`));
};

/**
 * Checagem estrutural (e não instanceof): o zod pode ser carregado em duas builds
 * (CJS via @bazar/shared e ESM), o que quebra o instanceof.
 */
function isZodError(err: unknown): err is ZodError {
  return err instanceof Error && err.name === 'ZodError' && Array.isArray((err as ZodError).issues);
}

/** Converte qualquer erro no formato { error: { code, message, details? } }. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let status = 500;
  let body: ApiErrorBody = {
    error: { code: 'INTERNAL_ERROR', message: 'Erro interno. Tente novamente mais tarde.' },
  };

  if (err instanceof AppError) {
    status = err.statusCode;
    body = { error: { code: err.code, message: err.message, details: err.details } };
  } else if (isZodError(err)) {
    status = 400;
    body = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    };
  } else if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    status = 409;
    body = { error: { code: 'CONFLICT', message: 'Registro duplicado' } };
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    body = { error: { code: 'INVALID_JSON', message: 'JSON inválido no corpo da requisição' } };
  }

  if (status >= 500) logger.error({ err }, 'erro não tratado');
  res.status(status).json(body);
};
