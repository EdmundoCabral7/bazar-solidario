import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { serverGet } from '@/lib/api';
import type { Animal } from '@/lib/types';
import { AdoptionForm } from './adoption-form';

export const metadata = { title: 'Formulário de adoção', robots: { index: false } };

export default async function AdoptionFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const animal = await serverGet<Animal>(`/api/animals/${slug}`, 15);
  if (!animal || animal.status === 'ADOPTED') notFound();
  return (
    <div className="mx-auto max-w-3xl px-4">
      <PageHeader
        title={`Quero adotar ${animal.name}`}
        description="Responda com sinceridade: o questionário ajuda a equipe a garantir que a adoção seja boa para você e para o animal. Leva uns 5 minutos."
      />
      <AdoptionForm animal={animal} />
    </div>
  );
}
