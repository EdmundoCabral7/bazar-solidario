import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

/** Valida req.body com um schema Zod e substitui pelo valor parseado. */
export const validateBody =
  (schema: ZodTypeAny): RequestHandler =>
  (req, _res, next) => {
    req.body = schema.parse(req.body);
    next();
  };
