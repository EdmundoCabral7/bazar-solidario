'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminTitle } from '@/components/admin/admin-shell';
import { DataTable, Td } from '@/components/admin/data-table';
import { Pager } from '@/components/admin/pager';
import { StatusBadge } from '@/components/status-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { errorMessage, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PLANS } from '@/lib/labels';
import type { Page } from '@/lib/types';
import { formatBRL, formatDateTime } from '@/lib/utils';

interface DonationRow {
  id: string;
  amountCents: number;
  donorName: string | null;
  donorEmail: string | null;
  anonymous: boolean;
  createdAt: string;
  campaign: { title: string } | null;
  payment: { status: string; method: string } | null;
}
interface SponsorshipRow {
  id: string;
  plan: string;
  amountCents: number;
  sponsorName: string;
  sponsorEmail: string;
  status: string;
  createdAt: string;
  animal: { name: string };
  _count: { payments: number };
}

export default function FundraisingPage() {
  const { request } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'doacoes' | 'padrinhos'>('doacoes');
  const [page, setPage] = useState(1);
  const donations = useQuery({
    queryKey: ['admin-donations', page],
    queryFn: () => request<Page<DonationRow>>(`/api/admin/donations${qs({ page, pageSize: 20 })}`),
    enabled: tab === 'doacoes',
  });
  const sponsors = useQuery({
    queryKey: ['admin-sponsorships', page],
    queryFn: () =>
      request<Page<SponsorshipRow>>(`/api/admin/sponsorships${qs({ page, pageSize: 20 })}`),
    enabled: tab === 'padrinhos',
  });
  const cancel = useMutation({
    mutationFn: (id: string) => request(`/api/admin/sponsorships/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-sponsorships'] }),
  });
  const current = tab === 'doacoes' ? donations : sponsors;

  return (
    <>
      <AdminTitle title="Doações e padrinhos" />
      <div role="tablist" aria-label="Tipo" className="mb-4 flex gap-2">
        {(['doacoes', 'padrinhos'] as const).map((t) => (
          <Button
            key={t}
            role="tab"
            aria-selected={tab === t}
            variant={tab === t ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setTab(t);
              setPage(1);
            }}
          >
            {t === 'doacoes' ? 'Doações avulsas' : 'Apadrinhamentos'}
          </Button>
        ))}
      </div>
      {(current.error || cancel.error) && (
        <Alert tone="danger" className="mb-3">
          {errorMessage(current.error ?? cancel.error)}
        </Alert>
      )}
      {tab === 'doacoes' ? (
        <DataTable caption="Doações" headers={['Data', 'Doador', 'Campanha', 'Valor', 'Pagamento']}>
          {donations.data?.data.map((d) => (
            <tr key={d.id}>
              <Td>{formatDateTime(d.createdAt)}</Td>
              <Td>
                {d.anonymous ? 'Anônimo' : (d.donorName ?? '—')}
                {d.donorEmail ? (
                  <span className="block text-xs text-muted-foreground">{d.donorEmail}</span>
                ) : null}
              </Td>
              <Td>{d.campaign?.title ?? '—'}</Td>
              <Td className="tabular-nums">{formatBRL(d.amountCents)}</Td>
              <Td>{d.payment && <StatusBadge kind="payment" value={d.payment.status} />}</Td>
            </tr>
          ))}
        </DataTable>
      ) : (
        <DataTable
          caption="Apadrinhamentos"
          headers={['Desde', 'Padrinho', 'Animal', 'Plano', 'Mensalidades pagas', 'Status', '']}
        >
          {sponsors.data?.data.map((s) => (
            <tr key={s.id}>
              <Td>{formatDateTime(s.createdAt)}</Td>
              <Td>
                {s.sponsorName}
                <span className="block text-xs text-muted-foreground">{s.sponsorEmail}</span>
              </Td>
              <Td>{s.animal.name}</Td>
              <Td>
                {PLANS[s.plan]?.label} · {formatBRL(s.amountCents)}
              </Td>
              <Td>{s._count.payments}</Td>
              <Td>
                <StatusBadge kind="sponsorship" value={s.status} />
              </Td>
              <Td>
                {s.status === 'ACTIVE' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => confirm('Cancelar este apadrinhamento?') && cancel.mutate(s.id)}
                  >
                    Cancelar
                  </Button>
                )}
              </Td>
            </tr>
          ))}
        </DataTable>
      )}
      {current.data && (
        <Pager page={current.data.page} totalPages={current.data.totalPages} onChange={setPage} />
      )}
    </>
  );
}
