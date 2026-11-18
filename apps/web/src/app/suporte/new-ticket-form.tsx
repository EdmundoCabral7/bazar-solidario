'use client';

import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { computePriority, createTicketSchema, type CreateTicketInput } from '@bazar/shared';
import { CopyButton } from '@/components/copy-button';
import { StatusBadge } from '@/components/status-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch, errorMessage, post } from '@/lib/api';
import { LEVELS, TICKET_TYPES, URGENCIES } from '@/lib/labels';
import type { ItServicesResponse, Priority } from '@/lib/types';
import { formatDateTime, formatMinutes } from '@/lib/utils';

const IMPACT_HINT: Record<string, string> = {
  LOW: 'Só comigo / um detalhe',
  MEDIUM: 'Algumas pessoas ou uma função',
  HIGH: 'Muita gente, ou envolve dinheiro',
};
const URGENCY_HINT: Record<string, string> = {
  LOW: 'Pode esperar alguns dias',
  MEDIUM: 'Atrapalha, mas tem como contornar',
  HIGH: 'Impede de usar agora',
};

export function NewTicketForm() {
  const { data: catalog } = useQuery({
    queryKey: ['it-services'],
    queryFn: () => apiFetch<ItServicesResponse>('/api/it-services'),
    staleTime: 300_000,
  });
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateTicketInput>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: { type: 'INCIDENT', impact: 'LOW', urgency: 'MEDIUM' },
  });
  const impact = watch('impact');
  const urgency = watch('urgency');
  const priority = computePriority(impact, urgency) as Priority;
  const target = catalog?.sla[priority];

  const create = useMutation({
    mutationFn: (v: CreateTicketInput) =>
      post<{
        protocol: string;
        priority: Priority;
        responseDueAt: string;
        resolutionDueAt: string;
      }>('/api/tickets', v),
  });

  if (create.data) {
    const t = create.data;
    return (
      <Alert tone="success" title="Chamado aberto!">
        <p>
          Protocolo <strong className="font-mono text-base">{t.protocol}</strong> — prioridade{' '}
          <StatusBadge kind="priority" value={t.priority} />
        </p>
        <p className="mt-2">
          Primeira resposta até <strong>{formatDateTime(t.responseDueAt)}</strong>; solução prevista
          até {formatDateTime(t.resolutionDueAt)}.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <CopyButton text={t.protocol} label="Copiar protocolo" />
          <Button asChild variant="outline">
            <Link href={`/suporte?protocolo=${t.protocol}`}>Acompanhar</Link>
          </Button>
        </div>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit((v) => create.mutate(v))} noValidate className="space-y-4">
      <Field id="serviceCode" label="Sobre qual serviço?" error={errors.serviceCode?.message}>
        <Select defaultValue="" {...register('serviceCode')}>
          <option value="" disabled>
            Selecione
          </option>
          {catalog?.services.map((s) => (
            <option key={s.code} value={s.code}>
              {s.code} — {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Tipo</legend>
        <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
          {(['INCIDENT', 'SERVICE_REQUEST'] as const).map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm">
              <input type="radio" value={t} {...register('type')} /> {TICKET_TYPES[t]}
            </label>
          ))}
        </div>
      </fieldset>
      <Field id="title" label="Resumo" error={errors.title?.message}>
        <Input placeholder="Ex.: não consigo finalizar o pagamento" {...register('title')} />
      </Field>
      <Field
        id="description"
        label="Descreva o que aconteceu"
        error={errors.description?.message}
        hint="Diga o que fez, o que esperava e o que aconteceu. Se possível, o celular/navegador."
      >
        <Textarea rows={4} {...register('description')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="impact" label="Quem é afetado?" hint={IMPACT_HINT[impact]}>
          <Select {...register('impact')}>
            {Object.entries(LEVELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="urgency" label="Qual a urgência?" hint={URGENCY_HINT[urgency]}>
          <Select {...register('urgency')}>
            {Object.entries(URGENCIES).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <p className="rounded-md bg-muted p-3 text-sm" aria-live="polite">
        Prioridade calculada: <StatusBadge kind="priority" value={priority} />
        {target && (
          <span className="mt-1 block text-muted-foreground">
            1ª resposta em até {formatMinutes(target.responseMinutes)}{' '}
            {target.continuous ? 'corridos' : 'úteis'} · solução em até{' '}
            {formatMinutes(target.resolutionMinutes)} {target.continuous ? 'corridas' : 'úteis'}
            {!target.continuous && ' (seg–sex, 8h–18h)'}
          </span>
        )}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="requesterName" label="Seu nome" error={errors.requesterName?.message}>
          <Input autoComplete="name" {...register('requesterName')} />
        </Field>
        <Field
          id="requesterEmail"
          label="E-mail para retorno"
          error={errors.requesterEmail?.message}
        >
          <Input type="email" autoComplete="email" {...register('requesterEmail')} />
        </Field>
      </div>
      {create.error && <Alert tone="danger">{errorMessage(create.error)}</Alert>}
      <Button type="submit" disabled={create.isPending}>
        {create.isPending ? 'Enviando…' : 'Abrir chamado'}
      </Button>
    </form>
  );
}
