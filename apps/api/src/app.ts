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
import { catalogRoutes, adminCatalogRoutes } from './modules/catalog/catalog.routes';
import { shippingRoutes } from './modules/shipping/shipping.routes';
import { orderRoutes, adminOrderRoutes } from './modules/orders/orders.routes';
import { donationRoutes } from './modules/donations/donations.routes';
import { adminFundraisingRoutes } from './modules/donations/admin.routes';
import { sponsorshipRoutes } from './modules/sponsorships/sponsorships.routes';
import { webhookRoutes, devRoutes } from './modules/payments/payments.routes';
import { adoptionRoutes, adminAdoptionRoutes } from './modules/adoptions/adoptions.routes';
import { transparencyRoutes, adminExpenseRoutes } from './modules/transparency/transparency.routes';
import { adminPartnerRoutes } from './modules/partners/partners.routes';
import { createPublicApiRoutes } from './modules/public-api/public-api.routes';
import { adminUserRoutes } from './modules/users/users.routes';
import { publicTicketRoutes, adminTicketRoutes } from './modules/tickets/tickets.routes';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes';

export interface AppOptions {
  /** Limite por minuto da API pública (testes usam um valor baixo). */
  publicApiRateLimit?: number;
}

export function createApp(opts: AppOptions = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(correlationId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).correlationId,
      customProps: (req) => ({ correlationId: (req as express.Request).correlationId }),
      autoLogging: { ignore: (req) => req.url === '/health' },
    }),
  );
  app.use((_req, res, next) => {
    res.on('finish', () => recordResponse(res.statusCode));
    next();
  });
  // Swagger UI usa scripts/estilos inline: CSP desligada só em /docs
  app.use('/docs', helmet({ contentSecurityPolicy: false }));
  app.use(helmet());
  // A API pública é server-to-server: CORS restrito vale para o portal; parceiros não usam navegador.
  app.use(
    cors({ origin: corsOrigins, exposedHeaders: ['x-correlation-id', 'Idempotent-Replayed'] }),
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

  // ----- público (portal) -----
  app.use('/api/auth', authRoutes);
  app.use('/api', catalogRoutes);
  app.use('/api', shippingRoutes);
  app.use('/api', publicTicketRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/donations', donationRoutes);
  app.use('/api/sponsorships', sponsorshipRoutes);
  app.use('/api/adoptions', adoptionRoutes);
  app.use('/api/transparency', transparencyRoutes);

  // ----- integrações -----
  app.use('/api/webhooks', webhookRoutes);
  app.use('/api/dev', devRoutes);
  app.use('/api/public/v1', createPublicApiRoutes(opts.publicApiRateLimit));

  // ----- administrativo (JWT) -----
  app.use('/api/admin/dashboard', dashboardRoutes);
  app.use('/api/admin', adminCatalogRoutes);
  app.use('/api/admin/orders', adminOrderRoutes);
  app.use('/api/admin/adoptions', adminAdoptionRoutes);
  app.use('/api/admin/expenses', adminExpenseRoutes);
  app.use('/api/admin/partners', adminPartnerRoutes);
  app.use('/api/admin/users', adminUserRoutes);
  app.use('/api/admin', adminFundraisingRoutes);
  app.use('/api/tickets', adminTicketRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
