import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  integrations,
  overrideIntegrations,
  resetIntegrations,
} from '../src/integrations/registry';
import type { NotificationProvider } from '../src/integrations/types';
import { prisma } from '../src/lib/prisma';
import { enqueueNotification } from '../src/modules/notifications/outbox';
import {
  OUTBOX_MAX_ATTEMPTS,
  outboxRetryDelayMs,
  processOutboxBatch,
} from '../src/modules/notifications/outbox.worker';
import { resetDb } from './helpers';

beforeEach(async () => {
  resetIntegrations();
  await resetDb();
});
afterAll(() => prisma.$disconnect());

describe('outbox + worker', () => {
  it('telefone vai por WhatsApp (E.164), sem telefone vai por e-mail', async () => {
    await enqueueNotification(prisma, { email: 'a@test.dev', phone: '84999991234' }, 'ORDER_PAID', {
      code: 'PED-1',
    });
    await enqueueNotification(prisma, { email: 'b@test.dev' }, 'DONATION_APPROVED', {
      amountCents: 1000,
    });
    const rows = await prisma.notificationOutbox.findMany({ orderBy: { createdAt: 'asc' } });
    expect(rows.map((r) => [r.channel, r.recipient])).toEqual([
      ['WHATSAPP', '5584999991234'],
      ['EMAIL', 'b@test.dev'],
    ]);
  });

  it('envia pendentes e marca SENT; não reenvia', async () => {
    await enqueueNotification(prisma, { phone: '84999991234' }, 'ORDER_PAID', { code: 'PED-ABC' });
    const first = await processOutboxBatch();
    expect(first).toMatchObject({ claimed: 1, sent: 1, failed: 0 });
    const wa = integrations().whatsapp as unknown as { sent: { body: string }[] };
    expect(wa.sent[0]!.body).toContain('PED-ABC');
    expect((await prisma.notificationOutbox.findFirstOrThrow()).status).toBe('SENT');
    expect((await processOutboxBatch()).claimed).toBe(0);
  });

  it('falha agenda nova tentativa com backoff e desiste após o máximo', async () => {
    const failing: NotificationProvider = {
      name: 'email',
      mode: 'mock',
      channel: 'EMAIL',
      send: async () => {
        throw new Error('SMTP fora do ar');
      },
      health: async () => ({ name: 'email', mode: 'mock', status: 'down' }),
    };
    overrideIntegrations({ email: failing });
    const item = await enqueueNotification(prisma, { email: 'x@test.dev' }, 'DONATION_APPROVED', {
      amountCents: 1,
    });

    await processOutboxBatch();
    let row = await prisma.notificationOutbox.findUniqueOrThrow({ where: { id: item!.id } });
    expect(row).toMatchObject({ status: 'PENDING', attempts: 1, lastError: 'SMTP fora do ar' });
    expect(row.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 20_000);

    // ainda não está na hora da próxima tentativa
    expect((await processOutboxBatch()).claimed).toBe(0);

    for (let i = 1; i < OUTBOX_MAX_ATTEMPTS; i++) {
      await prisma.notificationOutbox.update({
        where: { id: item!.id },
        data: { nextAttemptAt: new Date(0) },
      });
      await processOutboxBatch();
    }
    row = await prisma.notificationOutbox.findUniqueOrThrow({ where: { id: item!.id } });
    expect(row.status).toBe('FAILED');
    expect(row.attempts).toBe(OUTBOX_MAX_ATTEMPTS);
  });

  it('dois workers concorrentes não enviam a mesma mensagem', async () => {
    for (let i = 0; i < 10; i++)
      await enqueueNotification(prisma, { email: `u${i}@test.dev` }, 'DONATION_APPROVED', {
        amountCents: 1,
      });
    const [a, b] = await Promise.all([processOutboxBatch(10), processOutboxBatch(10)]);
    expect(a.claimed + b.claimed).toBe(10);
    const email = integrations().email as unknown as { sent: unknown[] };
    expect(email.sent).toHaveLength(10);
  });

  it('backoff exponencial limitado a 1 h', () => {
    expect(outboxRetryDelayMs(1)).toBe(30_000);
    expect(outboxRetryDelayMs(2)).toBe(60_000);
    expect(outboxRetryDelayMs(3)).toBe(120_000);
    expect(outboxRetryDelayMs(20)).toBe(3_600_000);
  });
});
