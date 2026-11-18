import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { serverGet } from '@/lib/api';
import { CONDITIONS } from '@/lib/labels';
import type { Product } from '@/lib/types';
import { formatBRL } from '@/lib/utils';
import { AddToCart } from './add-to-cart';

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const p = await serverGet<Product>(`/api/products/${slug}`);
  if (!p) return { title: 'Peça não encontrada' };
  const description = `${formatBRL(p.priceCents)} · ${CONDITIONS[p.condition]}. ${p.description}`;
  return {
    title: p.title,
    description,
    openGraph: {
      title: `${p.title} — Bazar Patas Potiguares`,
      description,
      images: p.photos.slice(0, 1),
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: p.title,
      description,
      images: p.photos.slice(0, 1),
    },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const product = await serverGet<Product>(`/api/products/${slug}`, 15);
  if (!product) notFound();
  const available = product.status === 'ACTIVE' && product.stock > 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav aria-label="Trilha" className="mb-4 text-sm text-muted-foreground">
        <Link href="/bazar" className="hover:underline">
          Bazar
        </Link>{' '}
        / <span>{product.category}</span>
      </nav>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-2">
          {(product.photos.length ? product.photos : ['/placeholder.svg']).map((src, i) => (
            <img
              key={src}
              src={src}
              alt={i === 0 ? `Foto de ${product.title}` : ''}
              className="w-full rounded-lg bg-muted object-cover"
            />
          ))}
        </div>
        <div className="space-y-4">
          <h1 className="text-2xl font-bold sm:text-3xl">{product.title}</h1>
          <p className="text-3xl font-semibold text-primary">{formatBRL(product.priceCents)}</p>
          <div className="flex flex-wrap gap-2">
            <Badge>{product.category}</Badge>
            {product.size && <Badge>Tamanho {product.size}</Badge>}
            <Badge tone="info">{CONDITIONS[product.condition]}</Badge>
          </div>
          <p className="whitespace-pre-line">{product.description}</p>
          {available ? (
            <AddToCart product={product} />
          ) : (
            <p className="rounded-md bg-muted p-3 text-sm font-medium" role="status">
              Esta peça já foi vendida.
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Retirada gratuita na sede (Natal/RN) ou envio pelos Correios. 100% da renda vai para os
            animais da associação.
          </p>
        </div>
      </div>
    </div>
  );
}
