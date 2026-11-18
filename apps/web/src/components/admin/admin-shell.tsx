'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Cat,
  ClipboardList,
  HandCoins,
  Headset,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  PawPrint,
  Receipt,
  Shirt,
  ShoppingCart,
  Users,
  X,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { ROLES } from '@/lib/labels';
import type { AuthUser } from '@/lib/types';
import { cn } from '@/lib/utils';

type Role = AuthUser['role'];
const NAV: { href: string; label: string; icon: typeof Cat; roles?: Role[] }[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/chamados', label: 'Central de serviços', icon: Headset },
  { href: '/admin/pedidos', label: 'Pedidos', icon: ShoppingCart },
  { href: '/admin/adocoes', label: 'Adoções', icon: ClipboardList, roles: ['ADMIN', 'VOLUNTEER'] },
  { href: '/admin/animais', label: 'Animais', icon: Cat, roles: ['ADMIN', 'VOLUNTEER'] },
  { href: '/admin/pecas', label: 'Peças do bazar', icon: Shirt, roles: ['ADMIN', 'VOLUNTEER'] },
  { href: '/admin/despesas', label: 'Despesas', icon: Receipt, roles: ['ADMIN'] },
  { href: '/admin/doacoes', label: 'Doações e padrinhos', icon: HandCoins, roles: ['ADMIN'] },
  { href: '/admin/parceiros', label: 'Parceiros (API)', icon: KeyRound, roles: ['ADMIN'] },
  { href: '/admin/usuarios', label: 'Usuários', icon: Users, roles: ['ADMIN'] },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, user, router, pathname]);

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-8" aria-busy="true">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const items = NAV.filter((n) => !n.roles || n.roles.includes(user.role));
  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  const nav = (
    <nav aria-label="Administração">
      <ul className="space-y-1">
        {items.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              onClick={() => setOpen(false)}
              aria-current={isActive(href) ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted',
                isActive(href) && 'bg-muted font-medium text-primary',
              )}
            >
              <Icon aria-hidden className="size-4" /> {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="hidden border-r border-border bg-card p-4 lg:flex lg:flex-col lg:gap-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-primary">
          <PawPrint aria-hidden className="size-5" /> Patas Potiguares
        </Link>
        {nav}
        <div className="mt-auto space-y-2 border-t border-border pt-4 text-sm">
          <p className="font-medium">{user.name}</p>
          <p className="text-xs text-muted-foreground">{ROLES[user.role]}</p>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <LogOut aria-hidden className="size-4" /> Sair
          </button>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
          <span className="font-semibold text-primary">Admin · Patas Potiguares</span>
          <button
            type="button"
            className="rounded-md p-2 hover:bg-muted"
            aria-expanded={open}
            aria-controls="admin-menu"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
          </button>
        </header>
        {open && (
          <div id="admin-menu" className="space-y-4 border-b border-border bg-card p-4 lg:hidden">
            {nav}
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <LogOut aria-hidden className="size-4" /> Sair ({user.name})
            </button>
          </div>
        )}
        <main id="admin-conteudo" className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export function AdminTitle({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}
