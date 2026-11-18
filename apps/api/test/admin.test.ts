import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { signToken } from '../src/middlewares/auth';
import { adminToken, createProduct, orderBody, resetDb } from './helpers';

const app = createApp();
let token: string;

beforeEach(async () => {
  await resetDb();
  token = (await adminToken()).token;
});
afterAll(() => prisma.$disconnect());
const auth = () => ({ authorization: `Bearer ${token}` });

describe('admin', () => {
  it('CRUD de animais gera slug e aparece na vitrine', async () => {
    const created = await request(app).post('/api/admin/animals').set(auth()).send({
      name: 'Paçoca',
      species: 'CAT',
      ageMonths: 6,
      size: 'SMALL',
      sex: 'FEMALE',
      description: 'Gatinha muito carinhosa',
    });
    expect(created.status).toBe(201);
    expect(created.body.slug).toBe('pacoca');
    const list = await request(app).get('/api/animals?species=CAT');
    expect(list.body.data[0].slug).toBe('pacoca');
  });

  it('voluntário não acessa despesas nem usuários (403)', async () => {
    const vol = signToken({ id: 'v', email: 'v@test.dev', role: 'VOLUNTEER' });
    expect(
      (await request(app).get('/api/admin/expenses').set('authorization', `Bearer ${vol}`)).status,
    ).toBe(403);
    expect(
      (await request(app).get('/api/admin/users').set('authorization', `Bearer ${vol}`)).status,
    ).toBe(403);
  });

  it('pedido pago: enviar → entregar, com rastreio e notificações', async () => {
    const product = await createProduct();
    const order = (
      await request(app)
        .post('/api/orders')
        .send({
          ...orderBody(product.id),
          delivery: {
            type: 'SHIPPING',
            cep: '59015000',
            street: 'Rua A',
            number: '1',
            district: 'Tirol',
            city: 'Natal',
            state: 'RN',
            shippingService: 'SEDEX',
          },
        })
    ).body;
    await request(app)
      .post(`/api/dev/payments/${order.payment.id}/simulate`)
      .send({ status: 'APPROVED' });
    const shipped = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set(auth())
      .send({ status: 'SHIPPED', trackingCode: 'BR123' });
    expect(shipped.body.delivery.trackingCode).toBe('BR123');
    const delivered = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set(auth())
      .send({ status: 'DELIVERED' });
    expect(delivered.body.status).toBe('DELIVERED');
    const back = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set(auth())
      .send({ status: 'PAID' });
    expect(back.status).toBe(409);
  });

  it('transparência: arrecadado × gasto no mês corrente', async () => {
    await prisma.expense.create({
      data: { category: 'RACAO', description: 'Ração', amountCents: 3000, spentAt: new Date() },
    });
    const d = await request(app)
      .post('/api/donations')
      .send({ amountCents: 10000, anonymous: true, payment: { method: 'PIX' } });
    await request(app)
      .post(`/api/dev/payments/${d.body.payment.id}/simulate`)
      .send({ status: 'APPROVED' });
    const res = await request(app).get('/api/transparency?months=3');
    expect(res.status).toBe(200);
    expect(res.body.months).toHaveLength(3);
    const current = res.body.months[2];
    expect(current.raisedCents).toMatchObject({ donations: 10000, total: 10000 });
    expect(current.spentCents).toMatchObject({ total: 3000, byCategory: { RACAO: 3000 } });
    expect(res.body.totals.balanceCents).toBe(7000);
  });

  it('dashboard consolida indicadores', async () => {
    const res = await request(app).get('/api/admin/dashboard').set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tickets.byPriority');
    expect(res.body).toHaveProperty('notifications.pending');
  });

  it('admin não pode se desativar', async () => {
    const me = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
    const res = await request(app)
      .patch(`/api/admin/users/${me.id}`)
      .set(auth())
      .send({ active: false });
    expect(res.status).toBe(400);
  });
});
