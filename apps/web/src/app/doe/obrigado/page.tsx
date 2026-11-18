'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/page-header';
import { PixPayment } from '@/components/pix-payment';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch, errorMessage } from '@/lib/api';
import type { Donation } from '@/lib/types';
import { formatBRL } from '@/lib/utils';

function DonationStatus() {
  const id = useSearchParams().get('id') ?? '';
  const key = ['donation', id];
  const { data, error, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => apiFetch<Donation>(`/api/donations/${id}`),
    enabled: !!id,
    refetchInterval: (q) => (q.state.data?.payment?.status === 'PENDING' ? 4000 : false),
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (error || !data)
    return (
      <Alert tone="danger" title="Doação não encontrada">
        {errorMessage(error)}
      </Alert>
    );
  const status = data.payment?.status;

  return (
    <div className="space-y-6">
      {status === 'APPROVED' && (
        <Alert
          tone="success"
          title={`Recebemos sua doação de ${formatBRL(data.amountCents)}. Muito obrigado! 💛`}
        >
          {data.campaign ? `Ela vai para a campanha “${data.campaign.title}”. ` : ''}
          Você pode ver como cada real é usado no{' '}
          <Link href="/transparencia" className="underline">
            painel de transparência
          </Link>
          .
        </Alert>
      )}
      {(status === 'REJECTED' || status === 'CANCELED') && (
        <Alert tone="danger" title="O pagamento não foi concluído">
          Nenhum valor foi cobrado.{' '}
          <Link href="/doe" className="underline">
            Tentar novamente
          </Link>
        </Alert>
      )}
      {data.payment && <PixPayment payment={data.payment} invalidateKey={key} />}
    </div>
  );
}

export default function ThanksPage() {
  return (
    <div className="mx-auto max-w-2xl px-4">
      <PageHeader title="Sua doação" />
      <Suspense>
        <DonationStatus />
      </Suspense>
    </div>
  );
}
