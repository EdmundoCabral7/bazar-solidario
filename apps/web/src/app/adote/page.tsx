import type { Metadata } from 'next';
import { AnimalCard } from '@/components/animal-card';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { qs, serverGet } from '@/lib/api';
import { SEXES, SIZES, SPECIES } from '@/lib/labels';
import type { Animal, Page } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Adote um animal',
  description: 'Cães e gatos resgatados em Natal/RN, castrados e vacinados, esperando um lar.',
};

export default async function AdoptPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const animals = await serverGet<Page<Animal>>(
    `/api/animals${qs({ species: sp.especie, size: sp.porte, sex: sp.sexo, page: sp.pagina ?? 1, pageSize: 12 })}`,
    15,
  );
  const filters = [
    { name: 'especie', label: 'Espécie', options: SPECIES },
    { name: 'porte', label: 'Porte', options: SIZES },
    { name: 'sexo', label: 'Sexo', options: SEXES },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4">
      <PageHeader
        title="Adote"
        description="Todos os animais são entregues vermifugados e, quando têm idade, castrados e vacinados. A adoção é gratuita e responsável."
      >
        <Button asChild variant="outline">
          <a href="/adote/acompanhar">Acompanhar minha solicitação</a>
        </Button>
      </PageHeader>

      <form
        method="get"
        className="mb-8 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4"
        aria-label="Filtrar animais"
      >
        {filters.map((f) => (
          <div key={f.name} className="min-w-36 flex-1 space-y-1">
            <Label htmlFor={f.name}>{f.label}</Label>
            <Select id={f.name} name={f.name} defaultValue={sp[f.name] ?? ''}>
              <option value="">Todos</option>
              {Object.entries(f.options).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
        ))}
        <Button type="submit">Filtrar</Button>
      </form>

      {!animals ? (
        <EmptyState title="Não foi possível carregar os animais agora" />
      ) : animals.data.length === 0 ? (
        <EmptyState title="Nenhum animal com esses filtros" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {animals.data.map((a) => (
              <AnimalCard key={a.id} animal={a} />
            ))}
          </div>
          <Pagination
            page={animals.page}
            totalPages={animals.totalPages}
            hrefFor={(p) =>
              `/adote${qs({ especie: sp.especie, porte: sp.porte, sexo: sp.sexo, pagina: p })}`
            }
          />
        </>
      )}
    </div>
  );
}
