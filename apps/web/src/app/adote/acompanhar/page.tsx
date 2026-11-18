'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { apiFetch, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

interface AdoptionStatus {
  code: string;
  status: string;
  animal: { slug: string; name: string; photo: string | null };
  createdAt: string;
  updatedAt: string;
}

const STEPS: Record<string, string> = {
  RECEIVED: 'Recebemos sua solicitação. A equipe começa a análise em breve.',
  IN_REVIEW: 'Estamos lendo suas respostas com atenção.',
  INTERVIEW:
    'Você foi chamado(a) para uma conversa! Entraremos em contato pelo WhatsApp para agendar.',
  APPROVED: 'Adoção aprovada! Vamos combinar a entrega do seu novo companheiro.',
  REJECTED:
    'Desta vez a adoção não foi aprovada. Obrigado pelo carinho — você pode conhecer outros animais.',
};

function Tracker() {
  const params = useSearchParams();
  const [code, setCode] = useState(params.get('codigo') ?? '');
  const [query, setQuery] = useState(params.get('codigo') ?? '');
  const { data, error, isFetching } = useQuery({
    queryKey: ['adoption', query],
    queryFn: () => apiFetch<AdoptionStatus>(`/api/adoptions/${encodeURIComponent(query.trim())}`),
    enabled: query.trim().length > 3,
    retry: false,
  });

  return (
    <div className="mx-auto max-w-2xl px-4">
      <PageHeader
        title="Acompanhar adoção"
        description="Informe o protocolo recebido ao enviar o formulário (ex.: ADO-4F7K2Q)."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(code);
        }}
        className="flex items-end gap-2"
      >
        <Field id="codigo" label="Protocolo" className="flex-1">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ADO-XXXXXX"
          />
        </Field>
        <Button type="submit" disabled={isFetching}>
          Consultar
        </Button>
      </form>
      <div className="mt-6" aria-live="polite">
        {error && <Alert tone="danger">{errorMessage(error)}</Alert>}
        {data && (
          <div className="flex gap-4 rounded-lg border border-border bg-card p-5">
            <img
              src={data.animal.photo ?? '/placeholder.svg'}
              alt=""
              className="size-20 rounded-md bg-muted object-cover"
            />
            <div className="space-y-2">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {data.code} ·{' '}
                <Link href={`/adote/${data.animal.slug}`} className="hover:underline">
                  {data.animal.name}
                </Link>
                <StatusBadge kind="adoption" value={data.status} />
              </p>
              <p>{STEPS[data.status]}</p>
              <p className="text-xs text-muted-foreground">
                Atualizado em {formatDateTime(data.updatedAt)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TrackAdoptionPage() {
  return (
    <Suspense>
      <Tracker />
    </Suspense>
  );
}
