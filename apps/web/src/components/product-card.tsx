import Link from 'next/link';
import type { Product } from '@/lib/types';
import { CONDITIONS } from '@/lib/labels';
import { formatBRL } from '@/lib/utils';

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/bazar/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-md"
    >
      <img
        src={product.photos[0] ?? '/placeholder.svg'}
        alt=""
        loading="lazy"
        className="aspect-square w-full bg-muted object-cover"
      />
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="font-medium group-hover:text-primary">{product.title}</h3>
        <p className="text-xs text-muted-foreground">
          {product.category}
          {product.size ? ` · Tam. ${product.size}` : ''} · {CONDITIONS[product.condition]}
        </p>
        <p className="mt-auto pt-2 text-lg font-semibold">{formatBRL(product.priceCents)}</p>
      </div>
    </Link>
  );
}
