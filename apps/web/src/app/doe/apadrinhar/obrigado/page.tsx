'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { apiFetch, errorMessage, post } from '@/lib/api';
import { PLANS } from '@/lib/labels';
import type { Sponsorship } from '@/lib/types';
import { formatBRL } from '@/lib/utils';

function SponsorshipStatus() {
  const id = useSearchParams().get('id') ?? '';
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [confirming, setConfirming] = useState(false);
  const key = ['sponsorship', id];
  const { data, error } = useQuery({
    queryKey: key,
    queryFn: () => apiFetch<Sponsorship>(`/api/sponsorships/${id}`),
    enabled: !!id,
    refetchInterval: (q) => (q.state.data?.status === 'PENDING' ? 4000 : false),
  });
  const cancel = useMutation({
    mutationFn: () => post<Sponsorship>(`/api/sponsorships/${id}/cancel`, { email }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  if (error) return <Alert tone="danger">{errorMessage(error)}</Alert>;
  if (!data) return null;
  return (
    <div className="space-y-6">
      <div className="flex gap-4 rounded-lg border border-border bg-card p-5">
        <img
          src={data.animal.photo ?? '/placeholder.svg'}
          alt=""
          className="size-24 rounded-md bg-muted object-cover"
        />
        <div className="space-y-1">
          <p className="flex flex-wrap items-center gap-2 text-lg font-semibold">
            {data.animal.name} <StatusBadge kind="sponsorship" value={data.status} />
          </p>
          <p>
            Plano {PLANS[data.plan]?.label} — {formatBRL(data.amountCents)}/mês
          </p>
        </div>
      </div>
      {data.status === 'ACTIVE' && (
        <Alert tone="success" title={`Agora você é padrinho/madrinha de ${data.animal.name}! 💛`}>
          Enviaremos notícias por e-mail. Guarde o link desta página para gerenciar o
          apadrinhamento.
        </Alert>
      )}
      {data.status === 'PENDING' && (
        <Alert tone="warning" title="Aguardando autorização do pagamento">
          {data.checkoutUrl ? (
            <a href={data.checkoutUrl} className="underline">
              Concluir no Mercado Pago
            </a>
          ) : (
            'Atualizando…'
          )}
        </Alert>
      )}
      {data.status === 'CANCELED' && (
        <Alert tone="info" title="Apadrinhamento cancelado">
          Obrigado por todo o apoio!{' '}
          <Link href="/doe/apadrinhar" className="underline">
            Apadrinhar novamente
          </Link>
        </Alert>
      )}
      {data.status === 'ACTIVE' && (
        <section aria-labelledby="cancelar" className="rounded-lg border border-border p-5">
          <h2 id="cancelar" className="mb-2 font-semibold">
            Cancelar apadrinhamento
          </h2>
          {!confirming ? (
            <Button variant="outline" onClick={() => setConfirming(true)}>
              Quero cancelar
            </Button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                cancel.mutate();
              }}
              className="flex flex-wrap items-end gap-2"
            >
              <Field
                id="email-cancelar"
                label="Confirme o e-mail usado no apadrinhamento"
                className="min-w-64 flex-1"
              >
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>
              <Button type="submit" disabled={cancel.isPending}>
                Confirmar cancelamento
              </Button>
            </form>
          )}
          {cancel.error && (
            <Alert tone="danger" className="mt-3">
              {errorMessage(cancel.error)}
            </Alert>
          )}
        </section>
      )}
    </div>
  );
}

export default function SponsorThanksPage() {
  return (
    <div className="mx-auto max-w-2xl px-4">
      <PageHeader title="Seu apadrinhamento" />
      <Suspense>
        <SponsorshipStatus />
      </Suspense>
    </div>
  );
}
