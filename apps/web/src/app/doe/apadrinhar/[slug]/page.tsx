import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { serverGet } from '@/lib/api';
import type { Animal } from '@/lib/types';
import { SponsorForm } from './sponsor-form';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await serverGet<Animal>(`/api/animals/${slug}`);
  return a
    ? { title: `Apadrinhe ${a.name}`, openGraph: { images: a.photos.slice(0, 1) } }
    : { title: 'Animal não encontrado' };
}

export default async function SponsorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const animal = await serverGet<Animal>(`/api/animals/${slug}`, 15);
  if (!animal || animal.status === 'ADOPTED') notFound();
  return (
    <div className="mx-auto max-w-4xl px-4">
      <PageHeader
        title={`Apadrinhe ${animal.name}`}
        description="Sua contribuição mensal cuida dele(a) até encontrar um lar."
      />
      <div className="grid gap-8 md:grid-cols-[280px_1fr]">
        <img
          src={animal.photos[0] ?? '/placeholder.svg'}
          alt={`Foto de ${animal.name}`}
          className="w-full rounded-lg bg-muted object-cover"
        />
        <SponsorForm animal={animal} />
      </div>
    </div>
  );
}
