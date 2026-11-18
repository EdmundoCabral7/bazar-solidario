import type { CreateDonationInput } from '@bazar/shared';
import { AppError } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { isUniqueViolation } from '../../lib/prisma-errors';
import { chargePayment, newIdempotencyKey, presentPayment } from '../payments/payment.service';

const ANONYMOUS_PAYER = 'doacao-anonima@pataspotiguares.org';

async function present(donationId: string) {
  const d = await prisma.donation.findUniqueOrThrow({
    where: { id: donationId },
    include: { payment: true, campaign: { select: { slug: true, title: true } } },
  });
  return {
    id: d.id,
    amountCents: d.amountCents,
    anonymous: d.anonymous,
    campaign: d.campaign,
    createdAt: d.createdAt,
    payment: d.payment ? presentPayment(d.payment) : null,
  };
}

export async function createDonation(input: CreateDonationInput, idempotencyKey?: string) {
  if (idempotencyKey) {
    const existing = await prisma.payment.findUnique({ where: { idempotencyKey } });
    if (existing?.donationId)
      return { replayed: true, donation: await present(existing.donationId) };
    if (existing) throw AppError.conflict('Idempotency-Key já usada em outra operação');
  }
  let campaignId: string | undefined;
  if (input.campaignSlug) {
    const campaign = await prisma.campaign.findUnique({ where: { slug: input.campaignSlug } });
    if (!campaign?.active) throw AppError.badRequest('Campanha inexistente ou encerrada');
    campaignId = campaign.id;
  }

  let created;
  try {
    created = await prisma.donation.create({
      data: {
        amountCents: input.amountCents,
        anonymous: input.anonymous,
        donorName: input.anonymous ? null : input.donorName,
        donorEmail: input.donorEmail,
        consentAt: input.donorEmail ? new Date() : null,
        campaignId,
        payment: {
          create: {
            provider: 'pending',
            method: input.payment.method,
            amountCents: input.amountCents,
            idempotencyKey: idempotencyKey ?? newIdempotencyKey(),
          },
        },
      },
      include: { payment: true },
    });
  } catch (err) {
    if (idempotencyKey && isUniqueViolation(err, 'idempotencyKey')) {
      const existing = await prisma.payment.findUniqueOrThrow({ where: { idempotencyKey } });
      return { replayed: true, donation: await present(existing.donationId!) };
    }
    throw err;
  }

  await chargePayment({
    payment: created.payment!,
    input: input.payment,
    description: 'Doação — Associação Patas Potiguares',
    payerEmail: input.donorEmail ?? ANONYMOUS_PAYER,
  });
  return { replayed: false, donation: await present(created.id) };
}

export async function getDonation(id: string) {
  const exists = await prisma.donation.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw AppError.notFound('Doação não encontrada');
  return present(id);
}
