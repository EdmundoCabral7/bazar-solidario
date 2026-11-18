import { env } from './config/env';
import { createApp } from './app';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';

const server = createApp().listen(env.PORT, () => {
  logger.info(
    `API ouvindo em http://localhost:${env.PORT} (docs em /docs, modo ${env.INTEGRATIONS_MODE})`,
  );
});

async function shutdown(signal: string) {
  logger.info({ signal }, 'encerrando API');
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
