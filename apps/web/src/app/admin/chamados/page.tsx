'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminTitle } from '@/components/admin/admin-shell';
import { DataTable, Td } from '@/components/admin/data-table';
import { Pager } from '@/components/admin/pager';
import { StatusBadge } from '@/components/status-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { errorMessage, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PRIORITIES, SUPPORT_LEVELS, TICKET_STATUS } from '@/lib/labels';
import type { Page, Ticket } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

const SERVICES = ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08'];

export default function TicketQueuePage() {
  const { request } = useAuth();
  const [page, setPage] = useState(1);
  const [f, setF] = useState({ status: '', priority: '', level: '', serviceCode: '', type: '' });
  const [scope, setScope] = useState<'active' | 'all'>('active');
  const { data, error } = useQuery({
    queryKey: ['admin-tickets', page, f, scope],
    queryFn: () => request<Page<Ticket>>(`/api/tickets${qs({ page, pageSize: 25, scope, ...f })}`),
    refetchInterval: 30_000,
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setF({ ...f, [k]: e.target.value });
    setPage(1);
  };

  return (
    <>
      <AdminTitle
        title="Central de serviços"
        description="Fila ordenada por prioridade e prazo de resolução. Indicador de SLA: no prazo, em risco (≥ 75% do prazo) ou violado."
      >
        <Button asChild variant="outline">
          <Link href="/admin/chamados/relatorio">Relatório de SLA</Link>
        </Button>
      </AdminTitle>
      <div role="tablist" aria-label="Escopo da fila" className="mb-3 flex gap-2">
        <Button
          size="sm"
          role="tab"
          aria-selected={scope === 'active'}
          variant={scope === 'active' ? 'default' : 'outline'}
          onClick={() => {
            setScope('active');
            setPage(1);
          }}
        >
          Em aberto
        </Button>
        <Button
          size="sm"
          role="tab"
          aria-selected={scope === 'all'}
          variant={scope === 'all' ? 'default' : 'outline'}
          onClick={() => {
            setScope('all');
            setPage(1);
          }}
        >
          Todos
        </Button>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Field id="f-status" label="Status">
          <Select value={f.status} onChange={set('status')}>
            <option value="">Todos</option>
            {Object.entries(TICKET_STATUS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="f-priority" label="Prioridade">
          <Select value={f.priority} onChange={set('priority')}>
            <option value="">Todas</option>
            {Object.entries(PRIORITIES).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="f-level" label="Nível">
          <Select value={f.level} onChange={set('level')}>
            <option value="">Todos</option>
            {Object.entries(SUPPORT_LEVELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="f-service" label="Serviço">
          <Select value={f.serviceCode} onChange={set('serviceCode')}>
            <option value="">Todos</option>
            {SERVICES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="f-type" label="Tipo">
          <Select value={f.type} onChange={set('type')}>
            <option value="">Todos</option>
            <option value="INCIDENT">Incidente</option>
            <option value="SERVICE_REQUEST">Requisição</option>
            <option value="PROBLEM">Problema</option>
          </Select>
        </Field>
      </div>
      {error && <Alert tone="danger">{errorMessage(error)}</Alert>}
      {data?.total === 0 && (
        <p className="mb-3 text-sm text-muted-foreground" role="status">
          Nenhum chamado em aberto com esses filtros. 🎉
        </p>
      )}
      <DataTable
        caption="Fila de chamados"
        headers={[
          'Protocolo',
          'Título',
          'Serviço',
          'Prioridade',
          'Nível',
          'Status',
          'SLA',
          'Prazo de resolução',
        ]}
      >
        {data?.data.map((t) => (
          <tr key={t.id} className="hover:bg-muted/40">
            <Td className="whitespace-nowrap font-mono text-xs">
              <Link href={`/admin/chamados/${t.id}`} className="text-primary hover:underline">
                {t.protocol}
              </Link>
            </Td>
            <Td>
              <Link href={`/admin/chamados/${t.id}`} className="hover:underline">
                {t.title}
              </Link>
              {t.type === 'PROBLEM' && (
                <span className="ml-1 text-xs text-muted-foreground">(problema)</span>
              )}
            </Td>
            <Td>{t.service.code}</Td>
            <Td>
              <StatusBadge kind="priority" value={t.priority} />
            </Td>
            <Td>{t.level}</Td>
            <Td>
              <StatusBadge kind="ticket" value={t.status} />
            </Td>
            <Td>
              <StatusBadge kind="sla" value={t.slaState} />
            </Td>
            <Td className="whitespace-nowrap">{formatDateTime(t.resolutionDueAt)}</Td>
          </tr>
        ))}
      </DataTable>
      {data && <Pager page={data.page} totalPages={data.totalPages} onChange={setPage} />}
    </>
  );
}
