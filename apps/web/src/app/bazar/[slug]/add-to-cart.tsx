'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/lib/cart-context';
import type { Product } from '@/lib/types';

export function AddToCart({ product }: { product: Product }) {
  const { items, dispatch } = useCart();
  const [added, setAdded] = useState(false);
  const inCart = items.find((i) => i.productId === product.id)?.quantity ?? 0;
  const maxed = inCart >= product.stock;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          size="lg"
          disabled={maxed}
          onClick={() => {
            dispatch({
              type: 'add',
              item: {
                productId: product.id,
                slug: product.slug,
                title: product.title,
                priceCents: product.priceCents,
                photo: product.photos[0] ?? null,
                stock: product.stock,
              },
            });
            setAdded(true);
          }}
        >
          {maxed ? 'Já está no carrinho' : 'Adicionar ao carrinho'}
        </Button>
        {inCart > 0 && (
          <Button asChild size="lg" variant="outline">
            <Link href="/carrinho">Ver carrinho</Link>
          </Button>
        )}
      </div>
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {added
          ? 'Peça adicionada ao carrinho.'
          : product.stock > 1
            ? `${product.stock} unidades disponíveis.`
            : 'Peça única.'}
      </p>
    </div>
  );
}
