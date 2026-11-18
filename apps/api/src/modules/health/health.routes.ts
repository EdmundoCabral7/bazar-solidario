import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { getIntegrations } from '../../integrations/registry';
import { snapshot } from '../../lib/metrics';

export const healthRoutes = Router();

/** Status da API, do banco e de cada integração. 503 se o banco estiver fora. */
healthRoutes.get('/health', async (_req, res) => {
  const started = Date.now();
  let database: { status: 'up' | 'down'; latencyMs?: number; detail?: string };
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = { status: 'up', latencyMs: Date.now() - started };
  } catch (err) {
    database = { status: 'down', detail: (err as Error).message.split('\n')[0] };
  }
  const integrations = await Promise.all(getIntegrations().map((i) => i.health()));
  const status = database.status === 'up' ? 'ok' : 'degraded';
  res.status(status === 'ok' ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    database,
    integrations,
  });
});

healthRoutes.get('/metrics', (_req, res) => {
  res.json(snapshot());
});
