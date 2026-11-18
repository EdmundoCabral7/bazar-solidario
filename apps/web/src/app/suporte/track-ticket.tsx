'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBadge } from '@/components/status-badge';
import { TicketTimeline } from '@/components/tickets/ticket-timeline';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch, errorMessage, post } from '@/lib/api';
import type { PublicTicket } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

export function TrackTicket() {
  const initial = useSearchParams().get('protocolo') ?? '';
  const [input, setInput] = useState(initial);
  const [protocol, setProtocol] = useState(initial);
  const [reply, setReply] = useState({ email: '', message: '' });
  const qc = useQueryClient();
  const key = ['ticket', protocol];
  const { data, error, isFetching } = useQuery({
    queryKey: key,
    queryFn: () =>
      apiFetch<PublicTicket>(`/api/tickets/protocol/${encodeURIComponent(protocol.trim())}`),
    enabled: protocol.trim().length > 5,
    retry: false,
  });
  const send = useMutation({
    mutationFn: () => post<PublicTicket>(`/api/tickets/protocol/${data!.protocol}/reply`, reply),
    onSuccess: (t) => {
      qc.setQueryData(key, t);
      setReply((r) => ({ ...r, message: '' }));
    },
  });

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setProtocol(input);
        }}
        className="flex items-end gap-2"
      >
        <Field id="protocolo" label="Protocolo" className="flex-1">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder="CH-2026-XXXXXX"
          />
        </Field>
        <Button type="submit" disabled={isFetching}>
          Consultar
        </Button>
      </form>
      <div aria-live="polite">
        {error && <Alert tone="danger">{errorMessage(error)}</Alert>}
        {data && (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="font-semibold">{data.title}</p>
              <p className="flex flex-wrap gap-2">
                <StatusBadge kind="ticket" value={data.status} />
                <StatusBadge kind="priority" value={data.priority} />
              </p>
              <p className="text-sm text-muted-foreground">
                {data.service.code} — {data.service.name}
              </p>
              {!data.resolvedAt && (
                <p className="text-sm">
                  Solução prevista até {formatDateTime(data.resolutionDueAt)}
                </p>
              )}
            </div>
            <TicketTimeline events={data.events} />
            {data.status === 'WAITING_USER' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send.mutate();
                }}
                className="space-y-3 rounded-md border border-border p-3"
              >
                <p className="text-sm font-medium">A equipe aguarda sua resposta</p>
                <Field id="reply-email" label="E-mail usado no chamado">
                  <Input
                    type="email"
                    required
                    value={reply.email}
                    onChange={(e) => setReply({ ...reply, email: e.target.value })}
                  />
                </Field>
                <Field id="reply-message" label="Mensagem">
                  <Textarea
                    required
                    rows={3}
                    value={reply.message}
                    onChange={(e) => setReply({ ...reply, message: e.target.value })}
                  />
                </Field>
                {send.error && <Alert tone="danger">{errorMessage(send.error)}</Alert>}
                <Button type="submit" size="sm" disabled={send.isPending}>
                  Responder
                </Button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
