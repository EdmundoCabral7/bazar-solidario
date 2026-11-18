import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { loginSchema } from '@bazar/shared';
import { env } from '../../config/env';
import { requireAuth } from '../../middlewares/auth';
import { validateBody } from '../../middlewares/validate';
import { authController } from './auth.controller';

export const authRoutes = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Aguarde alguns minutos.' },
  },
});

authRoutes.post('/login', loginLimiter, validateBody(loginSchema), authController.login);
authRoutes.get('/me', requireAuth, authController.me);
