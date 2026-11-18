import { env } from '../config/env';
import { logger } from '../lib/logger';
import { processOutboxBatch } from '../modules/notifications/outbox.worker';
import { expirePendingOrders } from '../modules/orders/orders.service';

/**
 * Laço do worker assíncrono:
 * - envia notificações da NotificationOutbox com retentativas e backoff exponencial;
 * - cancela pedidos com Pix não pago após ORDER_PAYMENT_TTL_MINUTES (devolve o estoque).
 * Roda como processo separado (`npm run worker`) ou dentro da API (RUN_WORKER_IN_PROCESS=true),
 * útil em hospedagens gratuitas sem background worker. Vários workers podem rodar juntos
 * (reserva com FOR UPDATE SKIP LOCKED).
 */
const POLL_INTERVAL_MS = 3000;
const EXPIRATION_EVERY_MS = 60_000;

export function startWorkerLoop() {
  let running = true;
  let lastExpiration = 0;

  async function tick() {
    const { claimed, sent, failed } = await processOutboxBatch();
    if (claimed > 0) logger.info({ claimed, sent, failed }, 'lote da outbox processado');
    if (Date.now() - lastExpiration > EXPIRATION_EVERY_MS) {
      lastExpiration = Date.now();
      const expired = await expirePendingOrders(env.ORDER_PAYMENT_TTL_MINUTES);
      if (expired > 0) logger.info({ expired }, 'pedidos com pagamento expirado cancelados');
    }
  }

  const done = (async () => {
    logger.info({ mode: env.INTEGRATIONS_MODE }, 'worker iniciado');
    while (running) {
      try {
        await tick();
      } catch (err) {
        logger.error({ err }, 'falha no ciclo do worker');
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    logger.info('worker encerrado');
  })();

  return {
    stop: async () => {
      running = false;
      await done;
    },
  };
}
