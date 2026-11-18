import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { MOCK_CARD_REJECTED } from '../src/integrations/mercadopago/mock';
import {
  integrations,
  overrideIntegrations,
  resetIntegrations,
} from '../src/integrations/registry';
import { ExternalServiceError } from '../src/lib/resilience';
import { prisma } from '../src/lib/prisma';
import { processWebhook } from '../src/modules/payments/webhook.service';
import { signedNotification } from '../src/modules/payments/payments.routes';
import { expirePendingOrders } from '../src/modules/orders/orders.service';
import { createProduct, orderBody, resetDb, seedItServices } from './helpers';

const app = createApp();

beforeEach(async () => {
  resetIntegrations();
  await resetDb();
  await seedItServices();
});
afterAll(() => prisma.$disconnect());

async function createPixOrder(productId: string, key?: string) {
  const req = request(app).post('/api/orders').send(orderBody(productId));
  if (key) req.set('Idempotency-Key', key);
  return req;
}

describe('pedido com Pix + webhook', () => {
  it('cria pedido pendente, reserva estoque e gera Pix', async () => {
    const product = await createProduct({ stock: 2 });
    const res = await createPixOrder(product.id);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING_PAYMENT');
    expect(res.body.payment).toMatchObject({ method: 'PIX', status: 'PENDING' });
    expect(res.body.payment.pixCopyPaste).toContain('BR.GOV.BCB.PIX');
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(1);
    expect(await prisma.notificationOutbox.count({ where: { template: 'ORDER_CREATED' } })).toBe(1);
  });

  it('simulador aprova → mesmo fluxo do webhook → pedido PAID e notificação', async () => {
    const product = await createProduct();
    const order = (await createPixOrder(product.id)).body;
    const sim = await request(app)
      .post(`/api/dev/payments/${order.payment.id}/simulate`)
      .send({ status: 'APPROVED' });
    expect(sim.status).toBe(200);
    expect(sim.body.webhook.status).toBe('processed');
    const tracked = await request(app).get(`/api/orders/${order.code}`);
    expect(tracked.body.status).toBe('PAID');
    expect(tracked.body.payment.status).toBe('APPROVED');
    expect(tracked.body.customer.email).toBe('ma***@test.dev');
    expect(await prisma.notificationOutbox.count({ where: { template: 'ORDER_PAID' } })).toBe(1);
  });

  it('IDEMPOTÊNCIA: a mesma notificação repetida não é processada duas vezes', async () => {
    const product = await createProduct();
    const order = (await createPixOrder(product.id)).body;
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: order.payment.id } });
    const mock = integrations()
      .payment as import('../src/integrations/mercadopago/mock').MockMercadoPagoProvider;
    mock.setPaymentStatus(payment.externalId!, 'APPROVED', {
      amountCents: payment.amountCents,
      externalReference: payment.id,
    });

    const notification = signedNotification('payment', payment.externalId!);
    const first = await request(app)
      .post('/api/webhooks/mercadopago')
      .query(notification.query)
      .set(notification.headers)
      .send(notification.body);
    const again = await request(app)
      .post('/api/webhooks/mercadopago')
      .query(notification.query)
      .set(notification.headers)
      .send(notification.body);
    expect(first.body.status).toBe('processed');
    expect(again.status).toBe(200);
    expect(again.body.status).toBe('duplicate');
    expect(await prisma.webhookEvent.count()).toBe(1);

    // notificação diferente para o mesmo pagamento: transição já aplicada → sem efeitos repetidos
    await processWebhook(signedNotification('payment', payment.externalId!));
    expect(await prisma.notificationOutbox.count({ where: { template: 'ORDER_PAID' } })).toBe(1);
  });

  it('webhook com assinatura inválida é recusado (401)', async () => {
    const res = await request(app)
      .post('/api/webhooks/mercadopago?data.id=1&type=payment')
      .set('x-signature', 'ts=1,v1=' + 'a'.repeat(64))
      .set('x-request-id', 'x')
      .send({ id: 'n1', type: 'payment', data: { id: '1' } });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_SIGNATURE');
  });

  it('pagamento recusado cancela o pedido e devolve o estoque', async () => {
    const product = await createProduct({ stock: 1 });
    const order = (await createPixOrder(product.id)).body;
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).status).toBe(
      'SOLD',
    );
    await request(app)
      .post(`/api/dev/payments/${order.payment.id}/simulate`)
      .send({ status: 'REJECTED' });
    const p = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(p.stock).toBe(1);
    expect(p.status).toBe('ACTIVE');
    expect((await request(app).get(`/api/orders/${order.code}`)).body.status).toBe('CANCELED');
  });

  it('valor divergente não aprova o pagamento', async () => {
    const product = await createProduct();
    const order = (await createPixOrder(product.id)).body;
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: order.payment.id } });
    const mock = integrations()
      .payment as import('../src/integrations/mercadopago/mock').MockMercadoPagoProvider;
    mock.setPaymentStatus(payment.externalId!, 'APPROVED', {
      amountCents: payment.amountCents,
      externalReference: payment.id,
    });
    // gateway aprovou um valor diferente do cobrado (ex.: adulteração)
    await prisma.payment.update({
      where: { id: payment.id },
      data: { amountCents: payment.amountCents + 100 },
    });
    await expect(
      processWebhook(signedNotification('payment', payment.externalId!)),
    ).rejects.toThrow(/diverge/);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe(
      'PENDING',
    );
  });
});

describe('Idempotency-Key na criação', () => {
  it('repetir a requisição devolve o mesmo pedido sem nova cobrança', async () => {
    const product = await createProduct({ stock: 5 });
    const a = await createPixOrder(product.id, 'chave-idem-0001');
    const b = await createPixOrder(product.id, 'chave-idem-0001');
    expect(a.status).toBe(201);
    expect(b.status).toBe(200);
    expect(b.headers['idempotent-replayed']).toBe('true');
    expect(b.body.code).toBe(a.body.code);
    expect(await prisma.order.count()).toBe(1);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(4);
  });

  it('chave em formato inválido → 400', async () => {
    const product = await createProduct();
    const res = await createPixOrder(product.id, 'x');
    expect(res.status).toBe(400);
  });
});

describe('cartão, estoque e falhas do gateway', () => {
  it('cartão aprovado na hora → pedido PAID', async () => {
    const product = await createProduct();
    const res = await request(app)
      .post('/api/orders')
      .send(
        orderBody(product.id, {
          method: 'CARD',
          cardToken: 'tok-ok',
          paymentMethodId: 'visa',
          installments: 1,
        }),
      );
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PAID');
  });

  it('cartão recusado → pedido CANCELED', async () => {
    const product = await createProduct();
    const res = await request(app)
      .post('/api/orders')
      .send(orderBody(product.id, { method: 'CARD', cardToken: MOCK_CARD_REJECTED }));
    expect(res.body.status).toBe('CANCELED');
    expect(res.body.payment.status).toBe('REJECTED');
  });

  it('estoque insuficiente → 409', async () => {
    const product = await createProduct({ stock: 1 });
    const res = await request(app)
      .post('/api/orders')
      .send(orderBody(product.id, { method: 'PIX' }, 2));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('OUT_OF_STOCK');
  });

  it('gateway fora do ar → 502, pedido cancelado e estoque devolvido', async () => {
    const product = await createProduct({ stock: 1 });
    const broken = integrations().payment;
    overrideIntegrations({
      payment: Object.assign(Object.create(Object.getPrototypeOf(broken)), broken, {
        createPixCharge: async () => {
          throw new ExternalServiceError('mercadopago', 'indisponível');
        },
      }),
    });
    const res = await createPixOrder(product.id);
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('PAYMENT_PROVIDER_UNAVAILABLE');
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(1);
    expect((await prisma.order.findFirstOrThrow()).status).toBe('CANCELED');
  });

  it('frete é recalculado no servidor', async () => {
    const product = await createProduct();
    const res = await request(app)
      .post('/api/orders')
      .send({
        ...orderBody(product.id),
        delivery: {
          type: 'SHIPPING',
          cep: '59015-000',
          street: 'Rua A',
          number: '1',
          district: 'Tirol',
          city: 'Natal',
          state: 'RN',
          shippingService: 'PAC',
        },
      });
    expect(res.status).toBe(201);
    expect(res.body.shippingCents).toBe(1890);
    expect(res.body.totalCents).toBe(2500 + 1890);
  });
});

describe('expiração de pedidos pendentes (worker)', () => {
  it('cancela Pix não pago após o TTL e devolve o estoque', async () => {
    const product = await createProduct({ stock: 1 });
    const order = (await createPixOrder(product.id)).body;
    await prisma.payment.update({
      where: { id: order.payment.id },
      data: { createdAt: new Date(Date.now() - 2 * 3600_000) },
    });
    expect(await expirePendingOrders(60)).toBe(1);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      'CANCELED',
    );
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(1);
  });

  it('pagamento aprovado após expiração abre incidente automático', async () => {
    const product = await createProduct();
    const order = (await createPixOrder(product.id)).body;
    await prisma.payment.update({
      where: { id: order.payment.id },
      data: { createdAt: new Date(Date.now() - 2 * 3600_000) },
    });
    await expirePendingOrders(60);
    // o cliente pagou no último segundo: o gateway confirma depois do cancelamento local
    await request(app)
      .post(`/api/dev/payments/${order.payment.id}/simulate`)
      .send({ status: 'APPROVED' });
    expect(
      (await prisma.payment.findUniqueOrThrow({ where: { id: order.payment.id } })).status,
    ).toBe('APPROVED');
    const ticket = await prisma.ticket.findFirstOrThrow();
    expect(ticket.title).toContain(order.code);
    expect(ticket.priority).toBe('P2');
  });
});
