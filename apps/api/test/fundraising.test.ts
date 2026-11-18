import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { resetIntegrations } from '../src/integrations/registry';
import { prisma } from '../src/lib/prisma';
import { createAnimal, resetDb } from './helpers';

const app = createApp();

beforeEach(async () => {
  resetIntegrations();
  await resetDb();
});
afterAll(() => prisma.$disconnect());

describe('doações', () => {
  it('doação Pix aprovada notifica o doador', async () => {
    const res = await request(app)
      .post('/api/donations')
      .send({
        amountCents: 5000,
        donorName: 'Ana',
        donorEmail: 'ana@test.dev',
        consent: true,
        payment: { method: 'PIX' },
      });
    expect(res.status).toBe(201);
    await request(app)
      .post(`/api/dev/payments/${res.body.payment.id}/simulate`)
      .send({ status: 'APPROVED' });
    const d = await request(app).get(`/api/donations/${res.body.id}`);
    expect(d.body.payment.status).toBe('APPROVED');
    expect(
      await prisma.notificationOutbox.count({
        where: { template: 'DONATION_APPROVED', recipient: 'ana@test.dev' },
      }),
    ).toBe(1);
  });

  it('doação anônima sem e-mail é aceita; mínimo de R$ 5', async () => {
    const ok = await request(app)
      .post('/api/donations')
      .send({ amountCents: 500, anonymous: true, payment: { method: 'PIX' } });
    expect(ok.status).toBe(201);
    const low = await request(app)
      .post('/api/donations')
      .send({ amountCents: 100, payment: { method: 'PIX' } });
    expect(low.status).toBe(400);
  });

  it('e-mail sem consentimento LGPD é recusado', async () => {
    const res = await request(app)
      .post('/api/donations')
      .send({ amountCents: 1000, donorEmail: 'x@test.dev', payment: { method: 'PIX' } });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('consent');
  });

  it('doação vinculada a campanha soma no progresso', async () => {
    await prisma.campaign.create({
      data: {
        slug: 'castracao',
        title: 'Mutirão',
        description: 'Campanha de castração',
        goalCents: 10000,
        startsAt: new Date(Date.now() - 1000),
      },
    });
    const res = await request(app)
      .post('/api/donations')
      .send({
        amountCents: 2500,
        campaignSlug: 'castracao',
        anonymous: true,
        payment: { method: 'PIX' },
      });
    await request(app)
      .post(`/api/dev/payments/${res.body.payment.id}/simulate`)
      .send({ status: 'APPROVED' });
    const c = await request(app).get('/api/campaigns/castracao');
    expect(c.body.raisedCents).toBe(2500);
    expect(c.body.progressPct).toBe(25);
  });
});

describe('apadrinhamento (assinatura recorrente)', () => {
  const body = (slug: string) => ({
    animalSlug: slug,
    plan: 'P50',
    sponsorName: 'João',
    sponsorEmail: 'joao@test.dev',
    consent: true,
  });

  it('criar → autorizar → cobrar mensalidade → cancelar', async () => {
    const animal = await createAnimal();
    const created = await request(app).post('/api/sponsorships').send(body(animal.slug));
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ status: 'PENDING', amountCents: 5000 });
    expect(created.body.checkoutUrl).toContain('checkout-simulado');
    const id = created.body.id;

    const auth = await request(app)
      .post(`/api/dev/sponsorships/${id}/simulate`)
      .send({ event: 'AUTHORIZE' });
    expect(auth.body.sponsorship.status).toBe('ACTIVE');

    const charge = await request(app)
      .post(`/api/dev/sponsorships/${id}/simulate`)
      .send({ event: 'CHARGE' });
    expect(charge.body.webhook.status).toBe('processed');
    const payments = await prisma.payment.findMany({ where: { sponsorshipId: id } });
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ status: 'APPROVED', amountCents: 5000 });

    const wrongEmail = await request(app)
      .post(`/api/sponsorships/${id}/cancel`)
      .send({ email: 'outra@test.dev' });
    expect(wrongEmail.status).toBe(404);
    const canceled = await request(app)
      .post(`/api/sponsorships/${id}/cancel`)
      .send({ email: 'joao@test.dev' });
    expect(canceled.body.status).toBe('CANCELED');

    const templates = (await prisma.notificationOutbox.findMany()).map((n) => n.template).sort();
    expect(templates).toEqual([
      'SPONSORSHIP_ACTIVE',
      'SPONSORSHIP_CANCELED',
      'SPONSORSHIP_CHARGED',
    ]);
  });

  it('Idempotency-Key evita assinatura duplicada', async () => {
    const animal = await createAnimal();
    const a = await request(app)
      .post('/api/sponsorships')
      .set('Idempotency-Key', 'padrinho-0001')
      .send(body(animal.slug));
    const b = await request(app)
      .post('/api/sponsorships')
      .set('Idempotency-Key', 'padrinho-0001')
      .send(body(animal.slug));
    expect(b.status).toBe(200);
    expect(b.body.id).toBe(a.body.id);
    expect(await prisma.sponsorship.count()).toBe(1);
  });

  it('não permite apadrinhar animal já adotado', async () => {
    const animal = await createAnimal({ status: 'ADOPTED' });
    const res = await request(app).post('/api/sponsorships').send(body(animal.slug));
    expect(res.status).toBe(400);
  });
});
