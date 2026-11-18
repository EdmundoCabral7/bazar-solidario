import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { DonationForm } from './donation-form';

export const metadata: Metadata = {
  title: 'Doe',
  description: 'Doe por Pix ou cartão, ou apadrinhe um animal com uma contribuição mensal.',
};

export default function DonatePage() {
  return (
    <div className="mx-auto max-w-5xl px-4">
      <PageHeader
        title="Doe"
        description="Toda doação é publicada (sem identificar ninguém) no painel de transparência."
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <section aria-labelledby="avulsa" className="rounded-lg border border-border bg-card p-5">
          <h2 id="avulsa" className="mb-4 text-xl font-semibold">
            Doação avulsa
          </h2>
          <Suspense>
            <DonationForm />
          </Suspense>
        </section>
        <aside aria-labelledby="apadrinhe" className="h-fit space-y-3 rounded-lg bg-secondary p-5">
          <h2 id="apadrinhe" className="text-xl font-semibold">
            Apadrinhe um animal
          </h2>
          <p className="text-sm">
            Com R$ 20, R$ 50 ou R$ 100 por mês você garante ração, vacinas e cuidados de um animal
            específico enquanto ele espera um lar. Cancele quando quiser.
          </p>
          <Button asChild className="w-full">
            <Link href="/doe/apadrinhar">Escolher um afilhado</Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}
