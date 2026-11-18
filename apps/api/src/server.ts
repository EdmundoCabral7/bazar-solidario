import { env } from './config/env';
import { createApp } from './app';
import { startWorkerLoop } from './jobs/worker-loop';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';

const server = createApp().listen(env.PORT, () => {
  logger.info(`API ouvindo na porta ${env.PORT} (docs em /docs, modo ${env.INTEGRATIONS_MODE})`);
});

// Em hospedagem sem background worker (ex.: plano gratuito do Render), o worker roda aqui.
const worker = env.RUN_WORKER_IN_PROCESS ? startWorkerLoop() : null;

async function shutdown(signal: string) {
  logger.info({ signal }, 'encerrando API');
  server.close();
  await worker?.stop();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
