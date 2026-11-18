import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/page-header';
import { NewTicketForm } from './new-ticket-form';
import { TrackTicket } from './track-ticket';

export const metadata: Metadata = {
  title: 'Central de atendimento',
  description:
    'Relate um problema no site ou faça uma solicitação. Acompanhe pelo número de protocolo.',
};

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-5xl px-4">
      <PageHeader
        title="Central de atendimento"
        description="Algo não funcionou no site, ou precisa de ajuda? Abra um chamado — você recebe um protocolo e o prazo de resposta na hora."
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <section aria-labelledby="abrir" className="rounded-lg border border-border bg-card p-5">
          <h2 id="abrir" className="mb-4 text-xl font-semibold">
            Abrir chamado
          </h2>
          <NewTicketForm />
        </section>
        <section
          aria-labelledby="acompanhar"
          className="h-fit rounded-lg border border-border bg-card p-5"
        >
          <h2 id="acompanhar" className="mb-4 text-xl font-semibold">
            Acompanhar chamado
          </h2>
          <Suspense>
            <TrackTicket />
          </Suspense>
        </section>
      </div>
    </div>
  );
}
