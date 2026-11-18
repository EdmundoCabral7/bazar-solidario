import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { serverGet } from '@/lib/api';
import { SEXES, SIZES, SPECIES } from '@/lib/labels';
import type { Animal } from '@/lib/types';
import { formatAge } from '@/lib/utils';

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const a = await serverGet<Animal>(`/api/animals/${slug}`);
  if (!a) return { title: 'Animal não encontrado' };
  const title = `Adote ${a.name}!`;
  const description = `${SPECIES[a.species]}, ${SEXES[a.sex].toLowerCase()}, porte ${SIZES[a.size].toLowerCase()}, ${formatAge(a.ageMonths)}. ${a.description}`;
  return {
    title,
    description,
    openGraph: {
      title: `${title} — Patas Potiguares`,
      description,
      images: a.photos.slice(0, 1),
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title, description, images: a.photos.slice(0, 1) },
  };
}

export default async function AnimalPage({ params }: { params: Params }) {
  const { slug } = await params;
  const animal = await serverGet<Animal>(`/api/animals/${slug}`, 15);
  if (!animal) notFound();
  const facts = [
    ['Espécie', SPECIES[animal.species]],
    ['Sexo', SEXES[animal.sex]],
    ['Porte', SIZES[animal.size]],
    ['Idade aproximada', formatAge(animal.ageMonths)],
  ];
  const health = [
    ['Castrado(a)', animal.neutered],
    ['Vacinado(a)', animal.vaccinated],
  ] as const;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav aria-label="Trilha" className="mb-4 text-sm text-muted-foreground">
        <Link href="/adote" className="hover:underline">
          Adote
        </Link>{' '}
        / <span>{animal.name}</span>
      </nav>
      <div className="grid gap-8 md:grid-cols-2">
        <img
          src={animal.photos[0] ?? '/placeholder.svg'}
          alt={`Foto de ${animal.name}`}
          className="w-full rounded-lg bg-muted object-cover"
        />
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold">{animal.name}</h1>
            <StatusBadge kind="animal" value={animal.status} />
          </div>
          <dl className="grid grid-cols-2 gap-3">
            {facts.map(([k, v]) => (
              <div key={k} className="rounded-md bg-muted p-3">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <ul className="flex flex-wrap gap-4 text-sm">
            {health.map(([label, ok]) => (
              <li key={label} className="flex items-center gap-1">
                {ok ? (
                  <Check aria-hidden className="size-4 text-green-700" />
                ) : (
                  <X aria-hidden className="size-4 text-muted-foreground" />
                )}
                <span>
                  {label}: {ok ? 'sim' : 'ainda não'}
                </span>
              </li>
            ))}
          </ul>
          <p className="whitespace-pre-line">{animal.description}</p>
          {animal.status === 'ADOPTED' ? (
            <p role="status" className="rounded-md bg-muted p-3 font-medium">
              {animal.name} já encontrou um lar! 🎉
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button asChild size="lg">
                <Link href={`/adote/${animal.slug}/quero-adotar`}>Quero adotar {animal.name}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href={`/doe/apadrinhar/${animal.slug}`}>Apadrinhar</Link>
              </Button>
            </div>
          )}
          {!!animal.activeSponsors && (
            <p className="text-sm text-muted-foreground">
              {animal.activeSponsors}{' '}
              {animal.activeSponsors === 1 ? 'padrinho ajuda' : 'padrinhos ajudam'} {animal.name}{' '}
              todo mês.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
