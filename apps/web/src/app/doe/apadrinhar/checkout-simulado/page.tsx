'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CreditCard } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { apiFetch, errorMessage, post } from '@/lib/api';
import { PLANS } from '@/lib/labels';
import type { Sponsorship } from '@/lib/types';
import { formatBRL } from '@/lib/utils';

/** Substitui o checkout do Mercado Pago no modo demonstração. */
function SimulatedCheckout() {
  const router = useRouter();
  const id = useSearchParams().get('id') ?? '';
  const { data, error } = useQuery({
    queryKey: ['sponsorship', id],
    queryFn: () => apiFetch<Sponsorship>(`/api/sponsorships/${id}`),
    enabled: !!id,
  });
  const authorize = useMutation({
    mutationFn: (event: 'AUTHORIZE' | 'CANCEL') =>
      post(`/api/dev/sponsorships/${id}/simulate`, { event }),
    onSuccess: () => router.push(`/doe/apadrinhar/obrigado?id=${id}`),
  });

  if (error) return <Alert tone="danger">{errorMessage(error)}</Alert>;
  if (!data) return null;
  return (
    <div className="space-y-5 rounded-lg border-2 border-dashed border-sky-600/40 bg-card p-6">
      <Alert tone="info" title="Checkout simulado (modo demonstração)">
        Em produção, esta etapa acontece no site do Mercado Pago. Aqui simulamos a autorização da
        assinatura — o resultado chega à API pelo mesmo webhook que o gateway real usaria.
      </Alert>
      <div className="flex items-center gap-3">
        <CreditCard aria-hidden className="size-8 text-primary" />
        <div>
          <p className="font-semibold">
            Apadrinhamento de {data.animal.name} — plano {PLANS[data.plan]?.label}
          </p>
          <p className="text-muted-foreground">
            {formatBRL(data.amountCents)} por mês, cobrado no cartão
          </p>
        </div>
      </div>
      {authorize.error && <Alert tone="danger">{errorMessage(authorize.error)}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button
          size="lg"
          disabled={authorize.isPending || data.status !== 'PENDING'}
          onClick={() => authorize.mutate('AUTHORIZE')}
        >
          Autorizar assinatura
        </Button>
        <Button
          size="lg"
          variant="outline"
          disabled={authorize.isPending || data.status !== 'PENDING'}
          onClick={() => authorize.mutate('CANCEL')}
        >
          Desistir
        </Button>
      </div>
    </div>
  );
}

export default function SimulatedCheckoutPage() {
  return (
    <div className="mx-auto max-w-xl px-4">
      <PageHeader title="Pagamento" />
      <Suspense>
        <SimulatedCheckout />
      </Suspense>
    </div>
  );
}
