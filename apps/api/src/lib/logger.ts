import pino from 'pino';
import { env } from '../config/env';
import { getCorrelationId } from './request-context';

/** Logger JSON estruturado. Todo log inclui o correlationId da requisição corrente. */
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  base: { service: 'bazar-api' },
  mixin() {
    const correlationId = getCorrelationId();
    return correlationId ? { correlationId } : {};
  },
  redact: ['req.headers.authorization', 'req.headers["x-api-key"]', '*.password', '*.passwordHash'],
});
