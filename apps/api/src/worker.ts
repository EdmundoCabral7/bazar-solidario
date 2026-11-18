import { logger } from './lib/logger';
import { prisma } from './lib/prisma';

/**
 * Worker da NotificationOutbox (processo separado: `npm run worker`).
 * Fase 1: apenas faz polling e conta pendências. O envio com retentativas entra na Fase 2.
 */
const POLL_INTERVAL_MS = 5000;
let running = true;

async function tick() {
  const pending = await prisma.notificationOutbox.count({
    where: { status: 'PENDING', nextAttemptAt: { lte: new Date() } },
  });
  if (pending > 0) logger.info({ pending }, 'notificações pendentes na outbox');
}

async function loop() {
  logger.info('worker da outbox iniciado');
  while (running) {
    try {
      await tick();
    } catch (err) {
      logger.error({ err }, 'falha no ciclo do worker');
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  await prisma.$disconnect();
}

process.on('SIGINT', () => (running = false));
process.on('SIGTERM', () => (running = false));
void loop();
