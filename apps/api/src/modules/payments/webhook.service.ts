import type { Prisma } from '@prisma/client';
import { env } from '../../config/env';
import { verifyWebhookSignature } from '../../integrations/mercadopago/signature';
import { integrations } from '../../integrations/registry';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { increment } from '../../lib/metrics';
import { prisma } from '../../lib/prisma';
import { isUniqueViolation } from '../../lib/prisma-errors';
import { applyPaymentStatus } from './payment.service';
import { applySubscriptionStatus } from '../sponsorships/sponsorships.service';

const PROVIDER = 'mercadopago';

export interface WebhookRequest {
  headers: Record<string, string | undefined>;
  query: Record<string, unknown>;
  body:
    | { id?: string | number; type?: string; action?: string; data?: { id?: string | number } }
    | undefined;
}

export interface WebhookResult {
  status: 'processed' | 'duplicate' | 'ignored';
  eventId?: string;
}

/**
 * Fluxo completo de webhook do Mercado Pago (usado pela rota real e pelo simulador de dev):
 * 1. valida x-signature (HMAC-SHA256);
 * 2. registra WebhookEvent com chave única (provider, externalId) — notificação repetida é descartada;
 * 3. consulta o recurso no gateway (nunca confia no corpo do webhook);
 * 4. aplica a transição de status de forma idempotente;
 * 5. marca o evento como processado. Se algo falhar, o evento fica pendente e o retry do MP reprocessa.
 */
export async function processWebhook(req: WebhookRequest): Promise<WebhookResult> {
  increment('webhooks.received');
  const dataId = String(req.query['data.id'] ?? req.body?.data?.id ?? req.query.id ?? '');
  const type = String(req.query.type ?? req.body?.type ?? req.query.topic ?? '');
  const requestId = req.headers['x-request-id'];

  const valid = verifyWebhookSignature({
    signatureHeader: req.headers['x-signature'],
    requestId,
    dataId,
    secret: env.MERCADOPAGO_WEBHOOK_SECRET,
    toleranceSeconds: env.NODE_ENV === 'production' ? 300 : 0,
  });
  if (!valid) {
    increment('webhooks.invalid_signature');
    logger.warn({ dataId, type }, 'webhook com assinatura inválida');
    throw new AppError(401, 'INVALID_SIGNATURE', 'Assinatura do webhook inválida');
  }
  if (!dataId || !type) throw AppError.badRequest('Webhook sem data.id ou type');

  // Chave de idempotência: id da notificação (body.id) ou, na falta, o x-request-id.
  const externalId = `${type}:${String(req.body?.id ?? requestId)}`;
  let event;
  try {
    event = await prisma.webhookEvent.create({
      data: {
        provider: PROVIDER,
        externalId,
        type,
        payload: (req.body ?? {}) as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    event = await prisma.webhookEvent.findUniqueOrThrow({
      where: { provider_externalId: { provider: PROVIDER, externalId } },
    });
    if (event.processedAt) {
      increment('webhooks.duplicate');
      logger.info({ externalId }, 'webhook duplicado ignorado');
      return { status: 'duplicate', eventId: event.id };
    }
    // evento recebido antes mas não concluído: reprocessa
  }

  const handled = await dispatch(type, dataId);
  await prisma.webhookEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } });
  increment('webhooks.processed');
  return { status: handled ? 'processed' : 'ignored', eventId: event.id };
}

async function dispatch(type: string, dataId: string): Promise<boolean> {
  const { payment: gateway } = integrations();
  switch (type) {
    case 'payment': {
      const gp = await gateway.getPayment(dataId);
      let payment = await prisma.payment.findUnique({ where: { externalId: gp.externalId } });
      if (!payment && gp.externalReference) {
        payment = await prisma.payment.findUnique({ where: { id: gp.externalReference } });
      }
      if (!payment) {
        logger.warn({ dataId }, 'webhook de pagamento desconhecido');
        return false;
      }
      if (gp.status === 'APPROVED' && gp.amountCents !== payment.amountCents) {
        logger.error(
          { paymentId: payment.id, expected: payment.amountCents, got: gp.amountCents },
          'valor divergente',
        );
        throw new AppError(422, 'AMOUNT_MISMATCH', 'Valor pago diverge do valor cobrado');
      }
      await applyPaymentStatus(payment.id, gp.status, 'webhook');
      return true;
    }
    case 'subscription_preapproval': {
      const sub = await gateway.getSubscription(dataId);
      return applySubscriptionStatus(sub.externalId, sub.status, 'webhook');
    }
    case 'subscription_authorized_payment': {
      const ap = await gateway.getAuthorizedPayment(dataId);
      const sponsorship = await prisma.sponsorship.findUnique({
        where: { gatewaySubscriptionId: ap.subscriptionId },
      });
      if (!sponsorship) return false;
      // externalId único: a mesma cobrança mensal nunca é registrada duas vezes
      const payment = await prisma.payment.upsert({
        where: { externalId: ap.externalId },
        update: {},
        create: {
          provider: PROVIDER,
          externalId: ap.externalId,
          method: 'CARD',
          status: 'PENDING',
          amountCents: ap.amountCents,
          sponsorshipId: sponsorship.id,
        },
      });
      await applyPaymentStatus(payment.id, ap.status, 'webhook');
      return true;
    }
    default:
      logger.info({ type }, 'tipo de webhook não tratado');
      return false;
  }
}
