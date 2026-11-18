import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { corsOrigins } from './config/env';
import { logger } from './lib/logger';
import { recordResponse } from './lib/metrics';
import { correlationId } from './middlewares/correlation-id';
import { errorHandler, notFoundHandler } from './middlewares/error-handler';
import { openapiSpec } from './docs/openapi';
import { healthRoutes } from './modules/health/health.routes';
import { authRoutes } from './modules/auth/auth.routes';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(correlationId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).correlationId,
      customProps: (req) => ({ correlationId: (req as express.Request).correlationId }),
    }),
  );
  app.use((_req, res, next) => {
    res.on('finish', () => recordResponse(res.statusCode));
    next();
  });
  app.use(
    helmet({
      // Swagger UI usa scripts/estilos inline
      contentSecurityPolicy: false,
    }),
  );
  app.use(
    cors({
      origin: corsOrigins,
      exposedHeaders: ['x-correlation-id'],
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.get('/', (_req, res) => res.redirect('/docs'));
  app.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(openapiSpec, { customSiteTitle: 'Bazar Solidário — API' }),
  );
  app.get('/docs.json', (_req, res) => res.json(openapiSpec));

  app.use(healthRoutes);
  app.use('/api/auth', authRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
