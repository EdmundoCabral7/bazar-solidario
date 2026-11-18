import Link from 'next/link';
import { PawPrint } from 'lucide-react';

const nav = [
  { href: '/bazar', label: 'Bazar' },
  { href: '/adote', label: 'Adote' },
  { href: '/doe', label: 'Doe' },
  { href: '/transparencia', label: 'Transparência' },
  { href: '/suporte', label: 'Suporte' },
];

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold text-primary">
          <PawPrint aria-hidden className="size-6" />
          <span>Patas Potiguares</span>
        </Link>
        <nav aria-label="Principal">
          <ul className="flex flex-wrap gap-1 text-sm">
            {nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="rounded-md px-3 py-2 hover:bg-muted">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
