'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, PawPrint, ShoppingBag, X } from 'lucide-react';
import { useCart } from '@/lib/cart-context';
import { cn } from '@/lib/utils';

const nav = [
  { href: '/bazar', label: 'Bazar' },
  { href: '/adote', label: 'Adote' },
  { href: '/doe', label: 'Doe' },
  { href: '/transparencia', label: 'Transparência' },
  { href: '/suporte', label: 'Suporte' },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  if (pathname.startsWith('/admin')) return null;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-primary"
          onClick={() => setOpen(false)}
        >
          <PawPrint aria-hidden className="size-6" />
          <span>Patas Potiguares</span>
        </Link>
        <nav aria-label="Principal" className="hidden md:block">
          <ul className="flex gap-1 text-sm">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={pathname.startsWith(item.href) ? 'page' : undefined}
                  className={cn(
                    'rounded-md px-3 py-2 hover:bg-muted',
                    pathname.startsWith(item.href) && 'bg-muted font-medium',
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-1">
          <Link
            href="/carrinho"
            className="relative rounded-md p-2 hover:bg-muted"
            aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}
          >
            <ShoppingBag aria-hidden className="size-5" />
            {count > 0 && (
              <span
                aria-hidden
                className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground"
              >
                {count}
              </span>
            )}
          </Link>
          <button
            type="button"
            className="rounded-md p-2 hover:bg-muted md:hidden"
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="menu-mobile" aria-label="Principal" className="border-t border-border md:hidden">
          <ul className="mx-auto max-w-6xl px-2 py-2">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-3 hover:bg-muted"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
