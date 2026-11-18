'use client';

import Link from 'next/link';
import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { PixPayment } from '@/components/pix-payment';
import { StatusBadge } from '@/components/status-badge';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch, errorMessage } from '@/lib/api';
import type { Order } from '@/lib/types';
import { cn, formatBRL, formatDateTime } from '@/lib/utils';

export default function OrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const key = ['order', code];
  const {
    data: order,
    error,
    isLoading,
  } = useQuery({
    queryKey: key,
    queryFn: () => apiFetch<Order>(`/api/orders/${code}`),
    // atualiza sozinho enquanto o pagamento estiver pendente
    refetchInterval: (q) => (q.state.data?.status === 'PENDING_PAYMENT' ? 4000 : false),
  });

  if (isLoading)
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-64" />
      </div>
    );
  if (error || !order) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Alert tone="danger" title="Pedido não encontrado">
          {errorMessage(error)}
        </Alert>
      </div>
    );
  }

  const steps =
    order.delivery.type === 'PICKUP'
      ? ['PENDING_PAYMENT', 'PAID', 'DELIVERED']
      : ['PENDING_PAYMENT', 'PAID', 'SHIPPED', 'DELIVERED'];
  const stepLabels: Record<string, string> = {
    PENDING_PAYMENT: 'Pedido feito',
    PAID: 'Pago',
    SHIPPED: 'Enviado',
    DELIVERED: order.delivery.type === 'PICKUP' ? 'Retirado' : 'Entregue',
  };
  const current = steps.indexOf(order.status);

  return (
    <div className="mx-auto max-w-3xl px-4">
      <PageHeader
        title={`Pedido ${order.code}`}
        description={`Feito em ${formatDateTime(order.createdAt)}. Guarde este código para acompanhar.`}
      >
        <StatusBadge kind="order" value={order.status} />
      </PageHeader>

      {order.status === 'CANCELED' ? (
        <Alert tone="danger" title="Pedido cancelado">
          {order.payment?.status === 'REJECTED'
            ? 'O pagamento foi recusado. '
            : 'O pagamento não foi concluído a tempo. '}
          As peças voltaram para o bazar.{' '}
          <Link href="/bazar" className="underline">
            Fazer novo pedido
          </Link>
        </Alert>
      ) : (
        <ol className="mb-8 flex gap-2" aria-label="Andamento do pedido">
          {steps.map((s, i) => (
            <li
              key={s}
              className="flex flex-1 flex-col items-center gap-1 text-center text-xs"
              aria-current={i === current ? 'step' : undefined}
            >
              <span
                className={cn(
                  'flex size-8 items-center justify-center rounded-full border-2',
                  i <= current
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground',
                )}
              >
                {i < current || (i === current && s !== 'PENDING_PAYMENT') ? (
                  <Check aria-hidden className="size-4" />
                ) : (
                  i + 1
                )}
              </span>
              <span className={i <= current ? 'font-medium' : 'text-muted-foreground'}>
                {stepLabels[s]}
              </span>
            </li>
          ))}
        </ol>
      )}

      {order.status === 'PAID' && (
        <Alert tone="success" title="Pagamento confirmado!" className="mb-6">
          Obrigado por ajudar nossos animais. Avisaremos por WhatsApp quando o pedido sair.
        </Alert>
      )}
      {order.payment && (
        <div className="mb-6">
          <PixPayment payment={order.payment} invalidateKey={key} />
        </div>
      )}
      {order.delivery.trackingCode && (
        <Alert tone="info" title="Código de rastreio" className="mb-6">
          {order.delivery.trackingCode}
        </Alert>
      )}

      <section aria-labelledby="itens" className="rounded-lg border border-border bg-card p-5">
        <h2 id="itens" className="mb-3 font-semibold">
          Itens
        </h2>
        <ul className="divide-y divide-border">
          {order.items.map((i) => (
            <li key={i.productId} className="flex items-center gap-3 py-2">
              <img
                src={i.photo ?? '/placeholder.svg'}
                alt=""
                className="size-12 rounded bg-muted object-cover"
              />
              <span className="flex-1">
                {i.quantity}× {i.title}
              </span>
              <span>{formatBRL(i.unitPriceCents * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{formatBRL(order.subtotalCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Frete</dt>
            <dd>{order.shippingCents ? formatBRL(order.shippingCents) : 'Grátis'}</dd>
          </div>
          <div className="flex justify-between font-semibold">
            <dt>Total</dt>
            <dd>{formatBRL(order.totalCents)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-muted-foreground">
          {order.delivery.type === 'PICKUP'
            ? 'Retirada na sede — entraremos em contato pelo WhatsApp para combinar.'
            : `Entrega em ${order.delivery.street}, ${order.delivery.number} — ${order.delivery.city}/${order.delivery.state}.`}
        </p>
      </section>
    </div>
  );
}
