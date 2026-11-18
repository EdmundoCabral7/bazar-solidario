'use client';

import { Fragment, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminTitle } from '@/components/admin/admin-shell';
import { DataTable, Td } from '@/components/admin/data-table';
import { Pager } from '@/components/admin/pager';
import { StatusBadge } from '@/components/status-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { errorMessage, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ORDER_STATUS } from '@/lib/labels';
import type { Order, OrderStatus, Page } from '@/lib/types';
import { formatBRL, formatDateTime } from '@/lib/utils';

const NEXT: Record<OrderStatus, { status: OrderStatus; label: string }[]> = {
  PENDING_PAYMENT: [{ status: 'CANCELED', label: 'Cancelar' }],
  PAID: [
    { status: 'SHIPPED', label: 'Marcar como enviado' },
    { status: 'DELIVERED', label: 'Marcar como entregue/retirado' },
    { status: 'CANCELED', label: 'Cancelar (estorno manual)' },
  ],
  SHIPPED: [{ status: 'DELIVERED', label: 'Marcar como entregue' }],
  DELIVERED: [],
  CANCELED: [],
};

function OrderActions({ order }: { order: Order }) {
  const { request } = useAuth();
  const qc = useQueryClient();
  const [tracking, setTracking] = useState('');
  const update = useMutation({
    mutationFn: (status: OrderStatus) =>
      request(`/api/admin/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, trackingCode: tracking || undefined }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-orders'] }),
  });
  const actions = NEXT[order.status].filter(
    (a) => !(a.status === 'SHIPPED' && order.delivery.type === 'PICKUP'),
  );

  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2">
      <div className="space-y-1 text-sm">
        <p>
          <strong>{order.customer.name}</strong> · {order.customer.email} · {order.customer.phone}
        </p>
        <p>
          {order.delivery.type === 'PICKUP'
            ? 'Retirada na sede'
            : `${order.delivery.street}, ${order.delivery.number} ${order.delivery.complement ?? ''} — ${order.delivery.district}, ${order.delivery.city}/${order.delivery.state} · CEP ${order.delivery.cep}`}
        </p>
        <ul className="list-disc pl-5">
          {order.items.map((i) => (
            <li key={i.productId}>
              {i.quantity}× {i.title} — {formatBRL(i.unitPriceCents)}
            </li>
          ))}
        </ul>
        <p>
          Pagamento: {order.payment?.method}{' '}
          <StatusBadge kind="payment" value={order.payment?.status ?? 'PENDING'} />
        </p>
        {order.delivery.trackingCode && <p>Rastreio: {order.delivery.trackingCode}</p>}
      </div>
      {actions.length > 0 && (
        <div className="space-y-2">
          {order.status === 'PAID' && order.delivery.type === 'SHIPPING' && (
            <Field id={`rastreio-${order.id}`} label="Código de rastreio">
              <Input value={tracking} onChange={(e) => setTracking(e.target.value)} />
            </Field>
          )}
          <div className="flex flex-wrap gap-2">
            {actions.map((a) => (
              <Button
                key={a.status}
                size="sm"
                variant={a.status === 'CANCELED' ? 'outline' : 'default'}
                disabled={update.isPending}
                onClick={() =>
                  (a.status !== 'CANCELED' ||
                    confirm('Cancelar o pedido? O estoque volta para o bazar.')) &&
                  update.mutate(a.status)
                }
              >
                {a.label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            O comprador é avisado automaticamente (WhatsApp/e-mail).
          </p>
          {update.error && <Alert tone="danger">{errorMessage(update.error)}</Alert>}
        </div>
      )}
    </div>
  );
}

export default function AdminOrdersPage() {
  const { request } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const { data, error } = useQuery({
    queryKey: ['admin-orders', page, status],
    queryFn: () => request<Page<Order>>(`/api/admin/orders${qs({ page, pageSize: 20, status })}`),
  });

  return (
    <>
      <AdminTitle title="Pedidos do bazar" />
      <div className="mb-3 max-w-xs">
        <Field id="filtro" label="Status">
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            {Object.entries(ORDER_STATUS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {error && <Alert tone="danger">{errorMessage(error)}</Alert>}
      <DataTable
        caption="Pedidos"
        headers={['Código', 'Data', 'Cliente', 'Entrega', 'Total', 'Status', '']}
      >
        {data?.data.map((o) => (
          <Fragment key={o.id}>
            <tr>
              <Td className="font-mono">{o.code}</Td>
              <Td>{formatDateTime(o.createdAt)}</Td>
              <Td>{o.customer.name}</Td>
              <Td>{o.delivery.type === 'PICKUP' ? 'Retirada' : 'Correios'}</Td>
              <Td className="tabular-nums">{formatBRL(o.totalCents)}</Td>
              <Td>
                <StatusBadge kind="order" value={o.status} />
              </Td>
              <Td>
                <Button
                  size="sm"
                  variant="outline"
                  aria-expanded={open === o.id}
                  onClick={() => setOpen(open === o.id ? null : o.id)}
                >
                  {open === o.id ? 'Fechar' : 'Detalhes'}
                </Button>
              </Td>
            </tr>
            {open === o.id && (
              <tr>
                <td colSpan={7} className="bg-muted/30">
                  <OrderActions order={o} />
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </DataTable>
      {data && <Pager page={data.page} totalPages={data.totalPages} onChange={setPage} />}
    </>
  );
}
