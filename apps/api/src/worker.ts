import { prisma } from './lib/prisma';
import { startWorkerLoop } from './jobs/worker-loop';

/** Worker como processo separado: `npm run worker`. */
const worker = startWorkerLoop();

async function shutdown() {
  await worker.stop();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
