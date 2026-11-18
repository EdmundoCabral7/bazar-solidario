import type { SponsorshipStatus } from '@prisma/client';
import { SPONSORSHIP_PLAN_CENTS, type CreateSponsorshipInput } from '@bazar/shared';
import { env } from '../../config/env';
import { integrations, mockPaymentProvider } from '../../integrations/registry';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { isUniqueViolation } from '../../lib/prisma-errors';
import { ExternalServiceError } from '../../lib/resilience';
import { enqueueNotification } from '../notifications/outbox';
import { newIdempotencyKey } from '../payments/payment.service';

const TRANSITIONS: Record<SponsorshipStatus, SponsorshipStatus[]> = {
  PENDING: ['ACTIVE', 'CANCELED'],
  ACTIVE: ['PAUSED', 'CANCELED'],
  PAUSED: ['ACTIVE', 'CANCELED'],
  CANCELED: [],
};

async function present(id: string) {
  const s = await prisma.sponsorship.findUniqueOrThrow({
    where: { id },
    include: { animal: { select: { slug: true, name: true, photos: true } } },
  });
  return {
    id: s.id,
    status: s.status,
    plan: s.plan,
    amountCents: s.amountCents,
    animal: { slug: s.animal.slug, name: s.animal.name, photo: s.animal.photos[0] ?? null },
    checkoutUrl: s.status === 'PENDING' ? s.checkoutUrl : null,
    createdAt: s.createdAt,
    canceledAt: s.canceledAt,
  };
}

/**
 * Cria o apadrinhamento (PENDING) e a assinatura mensal no gateway (preapproval).
 * O padrinho conclui no checkout do gateway; a ativação chega por webhook.
 */
export async function createSponsorship(input: CreateSponsorshipInput, idempotencyKey?: string) {
  if (idempotencyKey) {
    const existing = await prisma.sponsorship.findUnique({ where: { idempotencyKey } });
    if (existing) return { replayed: true, sponsorship: await present(existing.id) };
  }
  const animal = await prisma.animal.findUnique({ where: { slug: input.animalSlug } });
  if (!animal || animal.status === 'ADOPTED')
    throw AppError.badRequest('Animal indisponível para apadrinhamento');

  const amountCents = SPONSORSHIP_PLAN_CENTS[input.plan];
  let sponsorship;
  try {
    sponsorship = await prisma.sponsorship.create({
      data: {
        animalId: animal.id,
        plan: input.plan,
        amountCents,
        sponsorName: input.sponsorName,
        sponsorEmail: input.sponsorEmail,
        consentAt: new Date(),
        idempotencyKey: idempotencyKey ?? newIdempotencyKey(),
      },
    });
  } catch (err) {
    if (idempotencyKey && isUniqueViolation(err, 'idempotencyKey')) {
      const existing = await prisma.sponsorship.findUniqueOrThrow({ where: { idempotencyKey } });
      return { replayed: true, sponsorship: await present(existing.id) };
    }
    throw err;
  }

  try {
    const sub = await integrations().payment.createSubscription({
      amountCents,
      reason: `Apadrinhamento de ${animal.name} — Patas Potiguares`,
      payerEmail: input.sponsorEmail,
      externalReference: sponsorship.id,
      backUrl: `${env.WEB_URL}/doe/apadrinhar/obrigado?id=${sponsorship.id}`,
      idempotencyKey: sponsorship.idempotencyKey!,
    });
    await prisma.sponsorship.update({
      where: { id: sponsorship.id },
      data: { gatewaySubscriptionId: sub.externalId, checkoutUrl: sub.checkoutUrl },
    });
  } catch (err) {
    logger.error({ err, sponsorshipId: sponsorship.id }, 'falha ao criar assinatura');
    await prisma.sponsorship.update({
      where: { id: sponsorship.id },
      data: { status: 'CANCELED', canceledAt: new Date() },
    });
    if (err instanceof ExternalServiceError) {
      throw new AppError(
        502,
        'PAYMENT_PROVIDER_UNAVAILABLE',
        'O serviço de pagamento está indisponível. Tente novamente em alguns minutos.',
      );
    }
    throw err;
  }
  return { replayed: false, sponsorship: await present(sponsorship.id) };
}

export async function getSponsorship(id: string) {
  const exists = await prisma.sponsorship.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw AppError.notFound('Apadrinhamento não encontrado');
  return present(id);
}

/** Aplica status da assinatura vindo do gateway (idempotente, condicional ao status anterior). */
export async function applySubscriptionStatus(
  gatewaySubscriptionId: string,
  status: SponsorshipStatus,
  source: string,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const s = await tx.sponsorship.findUnique({
      where: { gatewaySubscriptionId },
      include: { animal: true },
    });
    if (!s) return false;
    const from = (Object.keys(TRANSITIONS) as SponsorshipStatus[]).filter((k) =>
      TRANSITIONS[k].includes(status),
    );
    const res = await tx.sponsorship.updateMany({
      where: { id: s.id, status: { in: from } },
      data: { status, ...(status === 'CANCELED' ? { canceledAt: new Date() } : {}) },
    });
    if (res.count === 0) return false;
    logger.info({ sponsorshipId: s.id, status, source }, 'apadrinhamento atualizado');
    const payload = { name: s.sponsorName, animalName: s.animal.name, amountCents: s.amountCents };
    if (status === 'ACTIVE')
      await enqueueNotification(tx, { email: s.sponsorEmail }, 'SPONSORSHIP_ACTIVE', payload);
    if (status === 'CANCELED')
      await enqueueNotification(tx, { email: s.sponsorEmail }, 'SPONSORSHIP_CANCELED', payload);
    return true;
  });
}

/** Cancelamento pelo padrinho (confirma pelo e-mail) ou pelo admin (`byAdmin`). */
export async function cancelSponsorship(id: string, opts: { email?: string; byAdmin?: boolean }) {
  const s = await prisma.sponsorship.findUnique({ where: { id } });
  if (!s || (!opts.byAdmin && s.sponsorEmail.toLowerCase() !== opts.email?.toLowerCase())) {
    throw AppError.notFound('Apadrinhamento não encontrado para este e-mail');
  }
  if (s.status === 'CANCELED') return present(id);
  if (s.gatewaySubscriptionId) {
    try {
      await integrations().payment.cancelSubscription(s.gatewaySubscriptionId);
    } catch (err) {
      if (err instanceof ExternalServiceError) {
        throw new AppError(
          502,
          'PAYMENT_PROVIDER_UNAVAILABLE',
          'Não foi possível cancelar agora. Tente novamente em alguns minutos.',
        );
      }
      throw err;
    }
    await applySubscriptionStatus(
      s.gatewaySubscriptionId,
      'CANCELED',
      opts.byAdmin ? 'admin' : 'sponsor',
    );
  } else {
    await prisma.sponsorship.update({
      where: { id },
      data: { status: 'CANCELED', canceledAt: new Date() },
    });
  }
  return present(id);
}

/** Simulador (mock): altera a assinatura no gateway e devolve o webhook a disparar. */
export async function simulateSubscriptionEvent(
  id: string,
  event: 'AUTHORIZE' | 'CHARGE' | 'CANCEL',
) {
  const mock = mockPaymentProvider()!;
  const s = await prisma.sponsorship.findUnique({ where: { id } });
  if (!s?.gatewaySubscriptionId) throw AppError.notFound('Apadrinhamento não encontrado');
  const fallback = { amountCents: s.amountCents, externalReference: s.id };
  if (event === 'CHARGE') {
    if (s.status !== 'ACTIVE')
      throw AppError.conflict('Só é possível cobrar apadrinhamentos ativos');
    const ap = mock.chargeSubscription(s.gatewaySubscriptionId, s.amountCents);
    return { type: 'subscription_authorized_payment', dataId: ap.externalId };
  }
  mock.setSubscriptionStatus(
    s.gatewaySubscriptionId,
    event === 'AUTHORIZE' ? 'ACTIVE' : 'CANCELED',
    fallback,
  );
  return { type: 'subscription_preapproval', dataId: s.gatewaySubscriptionId };
}
