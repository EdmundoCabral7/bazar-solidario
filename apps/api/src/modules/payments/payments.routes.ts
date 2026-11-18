import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { createSignatureHeader } from '../../integrations/mercadopago/signature';
import { mockPaymentProvider } from '../../integrations/registry';
import { AppError } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { paymentLimiter } from '../../middlewares/rate-limit';
import { presentPayment } from './payment.service';
import { processWebhook } from './webhook.service';
import { simulateSubscriptionEvent } from '../sponsorships/sponsorships.service';

export const webhookRoutes = Router();

webhookRoutes.post('/mercadopago', async (req, res) => {
  const result = await processWebhook({
    headers: {
      'x-signature': req.header('x-signature'),
      'x-request-id': req.header('x-request-id'),
    },
    query: req.query as Record<string, unknown>,
    body: req.body,
  });
  res.status(200).json({ received: true, ...result });
});

/**
 * Simulador de pagamentos (somente INTEGRATIONS_MODE=mock). Dispara o MESMO fluxo do webhook:
 * monta uma notificação assinada e a envia para processWebhook.
 */
export const devRoutes = Router();

devRoutes.use((_req, _res, next) => {
  if (env.INTEGRATIONS_MODE !== 'mock' || !mockPaymentProvider()) {
    return next(AppError.notFound('Simulador disponível apenas com INTEGRATIONS_MODE=mock'));
  }
  next();
});
devRoutes.use(paymentLimiter);

export function signedNotification(type: string, dataId: string) {
  const requestId = randomUUID();
  return {
    headers: {
      'x-request-id': requestId,
      'x-signature': createSignatureHeader(dataId, requestId, env.MERCADOPAGO_WEBHOOK_SECRET),
    },
    query: { 'data.id': dataId, type },
    body: { id: `sim-${randomUUID()}`, type, action: `${type}.updated`, data: { id: dataId } },
  };
}

const simulatePaymentSchema = z.object({ status: z.enum(['APPROVED', 'REJECTED']) });

devRoutes.post('/payments/:id/simulate', async (req, res) => {
  const { status } = simulatePaymentSchema.parse(req.body);
  const payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
  if (!payment?.externalId) throw AppError.notFound('Pagamento não encontrado');
  mockPaymentProvider()!.setPaymentStatus(payment.externalId, status, {
    amountCents: payment.amountCents,
    externalReference: payment.id,
  });
  const webhook = await processWebhook(signedNotification('payment', payment.externalId));
  const updated = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
  res.json({ webhook, payment: presentPayment(updated) });
});

const simulateSubscriptionSchema = z.object({ event: z.enum(['AUTHORIZE', 'CHARGE', 'CANCEL']) });

devRoutes.post('/sponsorships/:id/simulate', async (req, res) => {
  const { event } = simulateSubscriptionSchema.parse(req.body);
  const { type, dataId } = await simulateSubscriptionEvent(req.params.id, event);
  const webhook = await processWebhook(signedNotification(type, dataId));
  const sponsorship = await prisma.sponsorship.findUniqueOrThrow({
    where: { id: req.params.id },
    select: { id: true, status: true, plan: true, amountCents: true },
  });
  res.json({ webhook, sponsorship });
});
