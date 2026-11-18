import type { OrderStatus, Prisma } from '@prisma/client';
import type { CreateOrderInput } from '@bazar/shared';
import { maskEmail, publicCode } from '../../lib/codes';
import { AppError } from '../../lib/errors';
import { pageArgs, toPage } from '../../lib/pagination';
import { prisma } from '../../lib/prisma';
import { isUniqueViolation } from '../../lib/prisma-errors';
import { enqueueNotification } from '../notifications/outbox';
import {
  applyPaymentStatus,
  chargePayment,
  newIdempotencyKey,
  presentPayment,
} from '../payments/payment.service';
import { loadCart, quoteShipping } from '../shipping/shipping.service';
import { restoreStock } from './stock';

const orderInclude = {
  items: { include: { product: { select: { slug: true, title: true, photos: true } } } },
  payment: true,
} satisfies Prisma.OrderInclude;
type FullOrder = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

function present(o: FullOrder, opts: { maskPii: boolean }) {
  return {
    id: o.id,
    code: o.publicCode,
    status: o.status,
    customer: {
      name: o.customerName,
      email: opts.maskPii ? maskEmail(o.customerEmail) : o.customerEmail,
      ...(opts.maskPii ? {} : { phone: o.customerPhone }),
    },
    delivery: {
      type: o.deliveryType,
      ...(o.deliveryType === 'SHIPPING'
        ? {
            cep: o.cep,
            street: o.street,
            number: o.number,
            complement: o.complement,
            district: o.district,
            city: o.city,
            state: o.state,
          }
        : {}),
      trackingCode: o.trackingCode,
    },
    items: o.items.map((i) => ({
      productId: i.productId,
      slug: i.product.slug,
      title: i.product.title,
      photo: i.product.photos[0] ?? null,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
    })),
    subtotalCents: o.subtotalCents,
    shippingCents: o.shippingCents,
    totalCents: o.totalCents,
    payment: o.payment ? presentPayment(o.payment) : null,
    createdAt: o.createdAt,
  };
}

async function load(id: string) {
  return prisma.order.findUniqueOrThrow({ where: { id }, include: orderInclude });
}

/**
 * Cria pedido + itens + pagamento PENDING numa transação (reservando estoque com UPDATE
 * condicional), enfileira a notificação e então cobra no gateway (fora da transação).
 * Com Idempotency-Key repetida devolve o mesmo pedido, sem nova cobrança.
 */
export async function createOrder(input: CreateOrderInput, idempotencyKey?: string) {
  if (idempotencyKey) {
    const existing = await prisma.payment.findUnique({ where: { idempotencyKey } });
    if (existing?.orderId)
      return { replayed: true, order: present(await load(existing.orderId), { maskPii: false }) };
    if (existing) throw AppError.conflict('Idempotency-Key já usada em outra operação');
  }

  const cart = await loadCart(input.items);
  const subtotalCents = cart.reduce((s, i) => s + i.product.priceCents * i.quantity, 0);

  // frete recalculado no servidor — nunca confiamos no valor enviado pelo cliente
  let shippingCents = 0;
  if (input.delivery.type === 'SHIPPING') {
    const { options } = await quoteShipping(input.delivery.cep, input.items);
    const chosen = options.find(
      (o) => o.service === (input.delivery as { shippingService: string }).shippingService,
    );
    if (!chosen)
      throw new AppError(
        422,
        'SHIPPING_SERVICE_UNAVAILABLE',
        'Opção de frete indisponível para este CEP',
      );
    shippingCents = chosen.priceCents;
  }
  const totalCents = subtotalCents + shippingCents;
  const address = input.delivery.type === 'SHIPPING' ? input.delivery : null;

  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
      for (const { product, quantity } of cart) {
        const res = await tx.product.updateMany({
          where: { id: product.id, status: 'ACTIVE', stock: { gte: quantity } },
          data: { stock: { decrement: quantity } },
        });
        if (res.count === 0)
          throw new AppError(409, 'OUT_OF_STOCK', `"${product.title}" acabou de ser vendido`);
        await tx.product.updateMany({
          where: { id: product.id, stock: 0 },
          data: { status: 'SOLD' },
        });
      }
      const created = await tx.order.create({
        data: {
          publicCode: publicCode('PED'),
          customerName: input.customer.name,
          customerEmail: input.customer.email,
          customerPhone: input.customer.phone,
          deliveryType: input.delivery.type,
          cep: address?.cep,
          street: address?.street,
          number: address?.number,
          complement: address?.complement,
          district: address?.district,
          city: address?.city,
          state: address?.state,
          subtotalCents,
          shippingCents,
          totalCents,
          consentAt: new Date(),
          items: {
            create: cart.map(({ product, quantity }) => ({
              productId: product.id,
              quantity,
              unitPriceCents: product.priceCents,
            })),
          },
          payment: {
            create: {
              provider: 'pending',
              method: input.payment.method,
              amountCents: totalCents,
              idempotencyKey: idempotencyKey ?? newIdempotencyKey(),
            },
          },
        },
        include: { payment: true },
      });
      await enqueueNotification(
        tx,
        { email: created.customerEmail, phone: created.customerPhone },
        'ORDER_CREATED',
        {
          code: created.publicCode,
          name: created.customerName.split(' ')[0],
          totalCents,
        },
      );
      return created;
    });
  } catch (err) {
    if (idempotencyKey && isUniqueViolation(err, 'idempotencyKey')) {
      const existing = await prisma.payment.findUniqueOrThrow({ where: { idempotencyKey } });
      return { replayed: true, order: present(await load(existing.orderId!), { maskPii: false }) };
    }
    throw err;
  }

  await chargePayment({
    payment: order.payment!,
    input: input.payment,
    description: `Pedido ${order.publicCode} — Bazar Patas Potiguares`,
    payerEmail: order.customerEmail,
  });
  return { replayed: false, order: present(await load(order.id), { maskPii: false }) };
}

/** Acompanhamento público pelo código do pedido (e-mail mascarado, sem telefone). */
export async function getOrderByCode(code: string) {
  const order = await prisma.order.findUnique({
    where: { publicCode: code.toUpperCase() },
    include: orderInclude,
  });
  if (!order) throw AppError.notFound('Pedido não encontrado');
  return present(order, { maskPii: true });
}

// ---------- Admin ----------

export async function listOrders(f: { page: number; pageSize: number; status?: OrderStatus }) {
  const where = { status: f.status };
  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
      ...pageArgs(f),
    }),
    prisma.order.count({ where }),
  ]);
  return toPage(
    rows.map((o) => present(o, { maskPii: false })),
    total,
    f,
  );
}

export async function getOrder(id: string) {
  const o = await prisma.order.findUnique({ where: { id }, include: orderInclude });
  if (!o) throw AppError.notFound('Pedido não encontrado');
  return present(o, { maskPii: false });
}

const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['CANCELED'],
  PAID: ['SHIPPED', 'DELIVERED', 'CANCELED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELED: [],
};

export async function updateOrderStatus(id: string, status: OrderStatus, trackingCode?: string) {
  const order = await prisma.order.findUnique({ where: { id }, include: { payment: true } });
  if (!order) throw AppError.notFound('Pedido não encontrado');
  if (!ORDER_TRANSITIONS[order.status].includes(status)) {
    throw new AppError(
      409,
      'INVALID_TRANSITION',
      `Não é possível mudar o pedido de ${order.status} para ${status}`,
    );
  }
  if (status === 'SHIPPED' && order.deliveryType === 'PICKUP') {
    throw AppError.badRequest('Pedido para retirada não pode ser marcado como enviado');
  }

  // pendente → cancelado: cancela o pagamento (que desfaz o pedido e devolve o estoque)
  if (order.status === 'PENDING_PAYMENT' && order.payment) {
    await applyPaymentStatus(order.payment.id, 'CANCELED', 'admin');
    return getOrder(id);
  }

  await prisma.$transaction(async (tx) => {
    const res = await tx.order.updateMany({
      where: { id, status: order.status },
      data: { status, ...(trackingCode ? { trackingCode } : {}) },
    });
    if (res.count === 0)
      throw AppError.conflict('O pedido foi alterado por outra operação. Recarregue.');
    if (status === 'CANCELED') await restoreStock(tx, id);
    const template =
      status === 'SHIPPED'
        ? 'ORDER_SHIPPED'
        : status === 'DELIVERED'
          ? 'ORDER_DELIVERED'
          : 'ORDER_CANCELED';
    await enqueueNotification(
      tx,
      { email: order.customerEmail, phone: order.customerPhone },
      template,
      {
        code: order.publicCode,
        trackingCode,
        reason:
          status === 'CANCELED'
            ? 'cancelado pela equipe; o estorno será feito em até 7 dias'
            : undefined,
      },
    );
  });
  return getOrder(id);
}

/** Usado pelo worker: cancela pedidos com Pix não pago após o TTL. */
export async function expirePendingOrders(ttlMinutes: number) {
  const cutoff = new Date(Date.now() - ttlMinutes * 60_000);
  const stale = await prisma.payment.findMany({
    where: { status: 'PENDING', orderId: { not: null }, createdAt: { lt: cutoff } },
    select: { id: true },
    take: 50,
  });
  let expired = 0;
  for (const p of stale) if (await applyPaymentStatus(p.id, 'CANCELED', 'expiration')) expired++;
  return expired;
}
