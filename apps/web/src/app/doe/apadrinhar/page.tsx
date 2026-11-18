import type { Metadata } from 'next';
import { AnimalCard } from '@/components/animal-card';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { serverGet } from '@/lib/api';
import { PLANS } from '@/lib/labels';
import type { Animal, Page } from '@/lib/types';
import { formatBRL } from '@/lib/utils';

export const metadata: Metadata = { title: 'Apadrinhe um animal' };

export default async function SponsorListPage() {
  const animals = await serverGet<Page<Animal>>('/api/animals?pageSize=50', 30);
  return (
    <div className="mx-auto max-w-6xl px-4">
      <PageHeader
        title="Apadrinhe um animal"
        description={`Escolha um afilhado e contribua todo mês: ${Object.values(PLANS)
          .map((p) => formatBRL(p.cents))
          .join(', ')}. Cancele quando quiser.`}
      />
      {!animals || animals.data.length === 0 ? (
        <EmptyState title="Nenhum animal disponível no momento" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {animals.data.map((a) => (
            <AnimalCard key={a.id} animal={a} href={`/doe/apadrinhar/${a.slug}`} />
          ))}
        </div>
      )}
    </div>
  );
}
