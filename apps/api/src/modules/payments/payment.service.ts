import { randomUUID } from 'node:crypto';
import type { Payment, PaymentStatus, Prisma } from '@prisma/client';
import type { PaymentInput } from '@bazar/shared';
import { integrations } from '../../integrations/registry';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { increment } from '../../lib/metrics';
import { prisma } from '../../lib/prisma';
import { ExternalServiceError } from '../../lib/resilience';
import { enqueueNotification } from '../notifications/outbox';
import { restoreStock } from '../orders/stock';
import { openSystemTicket } from '../tickets/tickets.service';

/**
 * Transições permitidas de pagamento. Qualquer outra é ignorada (idempotência).
 * CANCELED → APPROVED é aceito: o gateway é a fonte da verdade (ex.: Pix pago no último segundo
 * depois de o pedido expirar localmente) — nesse caso abre-se um incidente para estorno.
 */
const ALLOWED_FROM: Record<PaymentStatus, PaymentStatus[]> = {
  PENDING: [],
  APPROVED: ['PENDING', 'CANCELED'],
  REJECTED: ['PENDING'],
  CANCELED: ['PENDING'],
  REFUNDED: ['APPROVED'],
};

export function newIdempotencyKey() {
  return randomUUID();
}

/** Visão pública de um pagamento (sem payload bruto do gateway). */
export function presentPayment(p: Payment) {
  return {
    id: p.id,
    method: p.method,
    status: p.status,
    amountCents: p.amountCents,
    pixCopyPaste: p.pixCopyPaste,
    pixQrCodeBase64: p.pixQrCode,
    expiresAt: p.expiresAt,
    paidAt: p.paidAt,
  };
}

/**
 * Chama o gateway para um Payment já criado no banco (status PENDING) e grava o resultado.
 * Cartão pode voltar já aprovado/recusado → aplica a transição na hora.
 * Falha do gateway → pagamento cancelado e erro 502 (o alvo é desfeito pelo applyPaymentStatus).
 */
export async function chargePayment(params: {
  payment: Payment;
  input: PaymentInput;
  description: string;
  payerEmail: string;
}): Promise<Payment> {
  const { payment, input, description, payerEmail } = params;
  const { payment: gateway } = integrations();
  const base = {
    amountCents: payment.amountCents,
    description,
    payerEmail,
    idempotencyKey: payment.idempotencyKey!,
    externalReference: payment.id,
  };
  try {
    if (input.method === 'PIX') {
      const pix = await gateway.createPixCharge(base);
      return await prisma.payment.update({
        where: { id: payment.id },
        data: {
          provider: gateway.name,
          externalId: pix.externalId,
          pixCopyPaste: pix.copyPaste,
          pixQrCode: pix.qrCodeBase64,
          expiresAt: pix.expiresAt,
          rawResponse: pix.raw as Prisma.InputJsonValue,
        },
      });
    }
    const card = await gateway.createCardPayment({
      ...base,
      cardToken: input.cardToken,
      paymentMethodId: input.paymentMethodId,
      installments: input.installments,
    });
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        provider: gateway.name,
        externalId: card.externalId,
        rawResponse: card.raw as Prisma.InputJsonValue,
      },
    });
    if (card.status !== 'PENDING')
      await applyPaymentStatus(payment.id, card.status, 'gateway-sync');
    return prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
  } catch (err) {
    logger.error({ err, paymentId: payment.id }, 'falha ao criar cobrança no gateway');
    await applyPaymentStatus(payment.id, 'CANCELED', 'gateway-error');
    if (err instanceof ExternalServiceError) {
      throw new AppError(
        502,
        'PAYMENT_PROVIDER_UNAVAILABLE',
        'O serviço de pagamento está indisponível no momento. Tente novamente em alguns minutos.',
      );
    }
    throw err;
  }
}

/**
 * Aplica uma mudança de status vinda do gateway (webhook, resposta síncrona do cartão,
 * simulador ou expiração). É IDEMPOTENTE: a atualização é condicional ao status anterior,
 * dentro de transação; se outra execução já aplicou, nada acontece (nem efeitos colaterais).
 * Retorna true se a transição ocorreu.
 */
export async function applyPaymentStatus(
  paymentId: string,
  status: PaymentStatus,
  source: string,
): Promise<boolean> {
  const from = ALLOWED_FROM[status];
  if (from.length === 0) return false;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.payment.updateMany({
      where: { id: paymentId, status: { in: from } },
      data: { status, ...(status === 'APPROVED' ? { paidAt: new Date() } : {}) },
    });
    if (updated.count === 0) {
      logger.info({ paymentId, status, source }, 'transição de pagamento ignorada (já aplicada)');
      increment('payments.transition.skipped');
      return false;
    }
    increment(`payments.${status.toLowerCase()}`);
    logger.info({ paymentId, status, source }, 'pagamento atualizado');

    const payment = await tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { order: true, donation: true, sponsorship: { include: { animal: true } } },
    });

    if (payment.order) await onOrderPayment(tx, payment.order, status);
    if (payment.donation && status === 'APPROVED' && payment.donation.donorEmail) {
      await enqueueNotification(tx, { email: payment.donation.donorEmail }, 'DONATION_APPROVED', {
        name: payment.donation.anonymous ? null : payment.donation.donorName,
        amountCents: payment.amountCents,
      });
    }
    if (payment.sponsorship && status === 'APPROVED') {
      await enqueueNotification(
        tx,
        { email: payment.sponsorship.sponsorEmail },
        'SPONSORSHIP_CHARGED',
        {
          animalName: payment.sponsorship.animal.name,
          amountCents: payment.amountCents,
        },
      );
    }
    return true;
  });
}

async function onOrderPayment(
  tx: Prisma.TransactionClient,
  order: {
    id: string;
    publicCode: string;
    status: string;
    customerEmail: string;
    customerPhone: string;
  },
  status: PaymentStatus,
) {
  const recipient = { email: order.customerEmail, phone: order.customerPhone };
  if (status === 'APPROVED') {
    const res = await tx.order.updateMany({
      where: { id: order.id, status: 'PENDING_PAYMENT' },
      data: { status: 'PAID' },
    });
    if (res.count === 1) {
      await enqueueNotification(tx, recipient, 'ORDER_PAID', { code: order.publicCode });
    } else {
      // Pagamento aprovado depois de o pedido ter expirado/cancelado: vira incidente para estorno manual.
      logger.error({ orderId: order.id }, 'pagamento aprovado para pedido não pendente');
      await openSystemTicket(tx, {
        serviceCode: 'S01',
        title: `Pagamento aprovado para pedido ${order.publicCode} já cancelado`,
        description:
          'O gateway confirmou o pagamento após o pedido ter sido cancelado (expiração ou cancelamento manual). ' +
          'Verificar estoque e realizar estorno ou reativar o pedido.',
        impact: 'MEDIUM',
        urgency: 'HIGH',
      });
    }
  } else if (status === 'REJECTED' || status === 'CANCELED') {
    const res = await tx.order.updateMany({
      where: { id: order.id, status: 'PENDING_PAYMENT' },
      data: { status: 'CANCELED' },
    });
    if (res.count === 1) {
      await restoreStock(tx, order.id);
      await enqueueNotification(tx, recipient, 'ORDER_CANCELED', {
        code: order.publicCode,
        reason: status === 'REJECTED' ? 'pagamento recusado' : 'pagamento não concluído',
      });
    }
  }
}
