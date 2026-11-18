import type { NotificationOutbox } from '@prisma/client';
import { integrations } from '../../integrations/registry';
import { logger } from '../../lib/logger';
import { increment } from '../../lib/metrics';
import { prisma } from '../../lib/prisma';
import { renderTemplate } from './templates';

export const OUTBOX_MAX_ATTEMPTS = 6;
const LOCK_SECONDS = 120;

/** Backoff da outbox: 30 s, 1 min, 2 min, 4 min, 8 min... limitado a 1 h. */
export function outboxRetryDelayMs(attempts: number): number {
  return Math.min(30_000 * 2 ** Math.max(0, attempts - 1), 60 * 60 * 1000);
}

/**
 * Reserva um lote com FOR UPDATE SKIP LOCKED + lockedUntil: vários workers podem rodar em
 * paralelo sem enviar a mesma mensagem duas vezes; se um worker cair, a reserva expira.
 */
async function claimBatch(limit: number): Promise<NotificationOutbox[]> {
  // Usa o relógio da aplicação (o mesmo que grava nextAttemptAt), evitando descompasso com o do banco.
  const now = new Date();
  const lockUntil = new Date(now.getTime() + LOCK_SECONDS * 1000);
  return prisma.$queryRaw<NotificationOutbox[]>`
    UPDATE "NotificationOutbox"
       SET "lockedUntil" = ${lockUntil}
     WHERE id IN (
       SELECT id FROM "NotificationOutbox"
        WHERE status = 'PENDING'
          AND "nextAttemptAt" <= ${now}
          AND ("lockedUntil" IS NULL OR "lockedUntil" < ${now})
        ORDER BY "nextAttemptAt"
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
     )
    RETURNING *`;
}

async function deliver(item: NotificationOutbox) {
  const { whatsapp, email } = integrations();
  const provider = item.channel === 'WHATSAPP' ? whatsapp : email;
  const { subject, body } = renderTemplate(item.template, item.payload as Record<string, unknown>);
  return provider.send({ to: item.recipient, subject, body });
}

/** Processa um lote da outbox. Retorna quantas foram enviadas e quantas falharam. */
export async function processOutboxBatch(limit = 20) {
  const batch = await claimBatch(limit);
  let sent = 0;
  let failed = 0;
  for (const item of batch) {
    const attempts = item.attempts + 1;
    try {
      const { messageId } = await deliver(item);
      await prisma.notificationOutbox.update({
        where: { id: item.id },
        data: { status: 'SENT', attempts, sentAt: new Date(), lockedUntil: null, lastError: null },
      });
      increment('outbox.sent');
      logger.info(
        { outboxId: item.id, channel: item.channel, template: item.template, messageId },
        'notificação enviada',
      );
      sent++;
    } catch (err) {
      const giveUp = attempts >= OUTBOX_MAX_ATTEMPTS;
      await prisma.notificationOutbox.update({
        where: { id: item.id },
        data: {
          attempts,
          status: giveUp ? 'FAILED' : 'PENDING',
          nextAttemptAt: new Date(Date.now() + outboxRetryDelayMs(attempts)),
          lockedUntil: null,
          lastError: (err as Error).message.slice(0, 500),
        },
      });
      increment(giveUp ? 'outbox.failed' : 'outbox.retry');
      logger.warn(
        { outboxId: item.id, attempts, giveUp, err: (err as Error).message },
        'falha ao enviar notificação',
      );
      failed++;
    }
  }
  return { claimed: batch.length, sent, failed };
}
