'use client';

import Link from 'next/link';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { useCart } from '@/lib/cart-context';
import { formatBRL } from '@/lib/utils';

export default function CartPage() {
  const { items, subtotalCents, dispatch } = useCart();

  return (
    <div className="mx-auto max-w-3xl px-4">
      <PageHeader title="Carrinho" />
      {items.length === 0 ? (
        <EmptyState title="Seu carrinho está vazio">
          <Link href="/bazar" className="text-primary hover:underline">
            Conheça as peças do bazar
          </Link>
        </EmptyState>
      ) : (
        <>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {items.map((item) => (
              <li key={item.productId} className="flex gap-4 p-4">
                <img
                  src={item.photo ?? '/placeholder.svg'}
                  alt=""
                  className="size-20 shrink-0 rounded-md bg-muted object-cover"
                />
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex justify-between gap-2">
                    <Link href={`/bazar/${item.slug}`} className="font-medium hover:underline">
                      {item.title}
                    </Link>
                    <span className="font-semibold">
                      {formatBRL(item.priceCents * item.quantity)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Diminuir quantidade de ${item.title}`}
                      onClick={() =>
                        dispatch({
                          type: 'setQuantity',
                          productId: item.productId,
                          quantity: item.quantity - 1,
                        })
                      }
                    >
                      <Minus aria-hidden className="size-4" />
                    </Button>
                    <span aria-live="polite" className="w-8 text-center">
                      {item.quantity}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Aumentar quantidade de ${item.title}`}
                      disabled={item.quantity >= item.stock}
                      onClick={() =>
                        dispatch({
                          type: 'setQuantity',
                          productId: item.productId,
                          quantity: item.quantity + 1,
                        })
                      }
                    >
                      <Plus aria-hidden className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto"
                      onClick={() => dispatch({ type: 'remove', productId: item.productId })}
                    >
                      <Trash2 aria-hidden className="size-4" /> Remover
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Subtotal: <strong className="text-xl">{formatBRL(subtotalCents)}</strong>
              <span className="block text-sm text-muted-foreground">
                Frete calculado no próximo passo.
              </span>
            </p>
            <Button asChild size="lg">
              <Link href="/checkout">Fechar pedido</Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
