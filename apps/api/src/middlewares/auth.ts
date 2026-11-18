import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@bazar/shared';
import { env } from '../config/env';
import { AppError } from '../lib/errors';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

export function signToken(user: AuthUser): string {
  return jwt.sign({ email: user.email, role: user.role }, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/** Exige Bearer JWT válido. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) return next(AppError.unauthorized());
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as jwt.JwtPayload;
    req.user = { id: String(payload.sub), email: payload.email, role: payload.role };
    next();
  } catch {
    next(AppError.unauthorized('Token inválido ou expirado'));
  }
};

/** Exige que o usuário autenticado tenha um dos papéis informados. */
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) return next(AppError.forbidden());
    next();
  };
