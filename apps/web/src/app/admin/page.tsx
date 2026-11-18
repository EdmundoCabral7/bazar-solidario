'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AdminTitle } from '@/components/admin/admin-shell';
import { StatusBadge } from '@/components/status-badge';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ADOPTION_STATUS, ORDER_STATUS } from '@/lib/labels';
import { formatBRL } from '@/lib/utils';

interface Dashboard {
  sales: { count: number; totalCents: number };
  donations: { count: number; totalCents: number };
  sponsorships: { active: number; monthCents: number };
  orders: Record<string, number>;
  adoptionsInProgress: Record<string, number>;
  tickets: { open: number; byPriority: Record<string, number>; bySla: Record<string, number> };
  notifications: { pending: number; failed: number };
}

function Tile({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="rounded-lg border border-border bg-card p-4 hover:border-primary">
      {body}
    </Link>
  ) : (
    <div className="rounded-lg border border-border bg-card p-4">{body}</div>
  );
}

export default function DashboardPage() {
  const { request, user } = useAuth();
  const { data, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => request<Dashboard>('/api/admin/dashboard'),
    refetchInterval: 30_000,
  });

  return (
    <>
      <AdminTitle
        title={`Olá, ${user?.name.split(' ')[0]}`}
        description="Indicadores do mês corrente. Atualiza a cada 30 segundos."
      />
      {error && <Alert tone="danger">{errorMessage(error)}</Alert>}
      {!data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile
              label="Vendas do bazar"
              value={formatBRL(data.sales.totalCents)}
              sub={`${data.sales.count} pedidos pagos`}
              href="/admin/pedidos"
            />
            <Tile
              label="Doações"
              value={formatBRL(data.donations.totalCents)}
              sub={`${data.donations.count} doações`}
            />
            <Tile
              label="Padrinhos ativos"
              value={String(data.sponsorships.active)}
              sub={`${formatBRL(data.sponsorships.monthCents)} recebidos no mês`}
            />
            <Tile
              label="Chamados abertos"
              value={String(data.tickets.open)}
              sub={`${data.tickets.bySla.VIOLATED ?? 0} com SLA violado`}
              href="/admin/chamados"
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="mb-3 font-semibold">Chamados por prioridade</h2>
              <ul className="space-y-2">
                {Object.entries(data.tickets.byPriority).map(([p, n]) => (
                  <li key={p} className="flex items-center justify-between">
                    <StatusBadge kind="priority" value={p} />
                    <span className="tabular-nums">{n}</span>
                  </li>
                ))}
              </ul>
              <h3 className="mb-2 mt-4 text-sm font-medium">Situação do SLA</h3>
              <ul className="space-y-2">
                {(['ON_TRACK', 'AT_RISK', 'VIOLATED'] as const).map((s) => (
                  <li key={s} className="flex items-center justify-between">
                    <StatusBadge kind="sla" value={s} />
                    <span className="tabular-nums">{data.tickets.bySla[s] ?? 0}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="mb-3 font-semibold">Pedidos</h2>
              <ul className="space-y-2 text-sm">
                {Object.entries(ORDER_STATUS).map(([s, l]) => (
                  <li key={s} className="flex justify-between">
                    <span>{l}</span>
                    <span className="tabular-nums">{data.orders[s] ?? 0}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="mb-3 font-semibold">Adoções em andamento</h2>
              <ul className="space-y-2 text-sm">
                {(['RECEIVED', 'IN_REVIEW', 'INTERVIEW'] as const).map((s) => (
                  <li key={s} className="flex justify-between">
                    <span>{ADOPTION_STATUS[s]}</span>
                    <span className="tabular-nums">{data.adoptionsInProgress[s] ?? 0}</span>
                  </li>
                ))}
              </ul>
              <h3 className="mb-2 mt-4 text-sm font-medium">Fila de notificações</h3>
              <p className="text-sm">
                {data.notifications.pending} pendentes · {data.notifications.failed} com falha
              </p>
              {data.notifications.pending > 20 && (
                <p className="mt-1 text-xs text-destructive">
                  Verifique se o worker está rodando (npm run worker).
                </p>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
