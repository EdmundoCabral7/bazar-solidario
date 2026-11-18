'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminTitle } from '@/components/admin/admin-shell';
import { StatusBadge } from '@/components/status-badge';
import { TicketTimeline } from '@/components/tickets/ticket-timeline';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { LEVELS, SUPPORT_LEVELS, TICKET_STATUS, TICKET_TYPES, URGENCIES } from '@/lib/labels';
import type { Page, Ticket, TicketDetail, TicketStatus } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

const TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ['IN_PROGRESS', 'WAITING_USER', 'RESOLVED'],
  IN_PROGRESS: ['WAITING_USER', 'RESOLVED'],
  WAITING_USER: ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: [],
};
const LEVEL_ORDER = { N1: 1, N2: 2, N3: 3 } as const;

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { request } = useAuth();
  const qc = useQueryClient();
  const key = ['admin-ticket', id];
  const { data: t, error } = useQuery({
    queryKey: key,
    queryFn: () => request<TicketDetail>(`/api/tickets/${id}`),
  });
  const { data: users } = useQuery({
    queryKey: ['assignable'],
    queryFn: () =>
      request<{ id: string; name: string; role: string }[]>('/api/admin/users/assignable'),
  });
  const { data: problems } = useQuery({
    queryKey: ['problems'],
    queryFn: () => request<Page<Ticket>>(`/api/tickets${qs({ type: 'PROBLEM', pageSize: 100 })}`),
    enabled: t?.type === 'INCIDENT',
  });

  const [message, setMessage] = useState('');
  const [escalation, setEscalation] = useState({ toLevel: '', reason: '' });
  const act = useMutation({
    mutationFn: ({
      path,
      method = 'POST',
      body,
    }: {
      path: string;
      method?: string;
      body: unknown;
    }) =>
      request<TicketDetail>(`/api/tickets/${id}/${path}`, { method, body: JSON.stringify(body) }),
    onSuccess: (updated) => {
      qc.setQueryData(key, updated);
      qc.invalidateQueries({ queryKey: ['admin-tickets'] });
      setMessage('');
      setEscalation({ toLevel: '', reason: '' });
    },
  });

  if (error) return <Alert tone="danger">{errorMessage(error)}</Alert>;
  if (!t) return <Skeleton className="h-96" />;
  const higherLevels = (['N2', 'N3'] as const).filter((l) => LEVEL_ORDER[l] > LEVEL_ORDER[t.level]);

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/chamados" className="text-primary hover:underline">
          ← Fila de chamados
        </Link>
      </p>
      <AdminTitle
        title={`${t.protocol} · ${t.title}`}
        description={`${t.service.code} — ${t.service.name} · ${TICKET_TYPES[t.type]}`}
      >
        <div className="flex flex-wrap gap-2">
          <StatusBadge kind="priority" value={t.priority} />
          <StatusBadge kind="ticket" value={t.status} />
          <StatusBadge kind="sla" value={t.slaState} />
        </div>
      </AdminTitle>
      {act.error && (
        <Alert tone="danger" className="mb-4">
          {errorMessage(act.error)}
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="mb-2 font-semibold">Descrição</h2>
            <p className="whitespace-pre-line text-sm">{t.description}</p>
            <p className="mt-3 text-sm text-muted-foreground">
              Solicitante: {t.requesterName} · {t.requesterEmail}
            </p>
          </section>

          <section className="space-y-3 rounded-lg border border-border bg-card p-5">
            <h2 className="font-semibold">Responder / mudar status</h2>
            <Field
              id="mensagem"
              label="Mensagem ao solicitante"
              hint="Comentários e mudanças de status notificam o solicitante por e-mail."
            >
              <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!message.trim() || act.isPending}
                onClick={() => act.mutate({ path: 'comments', body: { message } })}
              >
                Comentar
              </Button>
              {TRANSITIONS[t.status].map((s) => (
                <Button
                  key={s}
                  size="sm"
                  disabled={act.isPending}
                  onClick={() =>
                    act.mutate({
                      path: 'status',
                      method: 'PATCH',
                      body: { status: s, message: message || undefined },
                    })
                  }
                >
                  {s === 'IN_PROGRESS' && t.status === 'RESOLVED'
                    ? 'Reabrir'
                    : `→ ${TICKET_STATUS[s]}`}
                </Button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="mb-3 font-semibold">Histórico</h2>
            <TicketTimeline events={t.events} />
          </section>
        </div>

        <aside className="space-y-4">
          <section className="space-y-1 rounded-lg border border-border bg-card p-4 text-sm">
            <h2 className="mb-2 font-semibold">SLA</h2>
            <p>
              Impacto {LEVELS[t.impact]} × urgência {URGENCIES[t.urgency]}
            </p>
            <p>Aberto: {formatDateTime(t.createdAt)}</p>
            <p>
              1ª resposta até: {formatDateTime(t.responseDueAt)}{' '}
              {t.firstResponseAt && (
                <span className="text-muted-foreground">
                  (respondido {formatDateTime(t.firstResponseAt)})
                </span>
              )}
            </p>
            <p>
              Resolução até: {formatDateTime(t.resolutionDueAt)}{' '}
              {t.resolvedAt && (
                <span className="text-muted-foreground">
                  (resolvido {formatDateTime(t.resolvedAt)})
                </span>
              )}
            </p>
          </section>

          <section className="space-y-3 rounded-lg border border-border bg-card p-4">
            <h2 className="font-semibold">Atendimento</h2>
            <p className="text-sm">
              Nível atual: <strong>{SUPPORT_LEVELS[t.level]}</strong>
            </p>
            <Field id="responsavel" label="Responsável">
              <Select
                value={t.assigneeId ?? ''}
                onChange={(e) =>
                  act.mutate({ path: 'assign', body: { assigneeId: e.target.value || null } })
                }
              >
                <option value="">Ninguém</option>
                {users?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
            {higherLevels.length > 0 && !['RESOLVED', 'CLOSED'].includes(t.status) && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  act.mutate({ path: 'escalate', body: escalation });
                }}
                className="space-y-2 border-t border-border pt-3"
              >
                <Field id="nivel" label="Escalonar para">
                  <Select
                    required
                    value={escalation.toLevel}
                    onChange={(e) => setEscalation({ ...escalation, toLevel: e.target.value })}
                  >
                    <option value="" disabled>
                      Selecione
                    </option>
                    {higherLevels.map((l) => (
                      <option key={l} value={l}>
                        {SUPPORT_LEVELS[l]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field id="motivo" label="Motivo">
                  <Input
                    required
                    minLength={5}
                    value={escalation.reason}
                    onChange={(e) => setEscalation({ ...escalation, reason: e.target.value })}
                  />
                </Field>
                <Button size="sm" type="submit" variant="outline" disabled={act.isPending}>
                  Escalonar
                </Button>
              </form>
            )}
          </section>

          {t.type === 'INCIDENT' && (
            <section className="space-y-2 rounded-lg border border-border bg-card p-4">
              <h2 className="font-semibold">Gerenciamento de problemas</h2>
              <Field
                id="problema"
                label="Vincular a um problema"
                hint="Use quando o incidente se repete e há uma causa-raiz em investigação."
              >
                <Select
                  value={t.problemId ?? ''}
                  onChange={(e) =>
                    act.mutate({ path: 'problem', body: { problemId: e.target.value || null } })
                  }
                >
                  <option value="">Nenhum</option>
                  {problems?.data.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.protocol} — {p.title}
                    </option>
                  ))}
                </Select>
              </Field>
            </section>
          )}
          {t.type === 'PROBLEM' && (
            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="mb-2 font-semibold">Incidentes vinculados ({t.incidents.length})</h2>
              <ul className="space-y-1 text-sm">
                {t.incidents.map((i) => (
                  <li key={i.id}>
                    <Link href={`/admin/chamados/${i.id}`} className="text-primary hover:underline">
                      {i.protocol}
                    </Link>{' '}
                    — {i.title}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
