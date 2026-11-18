'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function SiteFooter() {
  const pathname = usePathname();
  if (pathname.startsWith('/admin')) return null;
  return (
    <footer className="mt-16 border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-8 text-sm text-muted-foreground sm:grid-cols-2">
        <div className="space-y-2">
          <p>
            <strong className="text-foreground">Entidade simulada para fins acadêmicos.</strong> A
            Associação Patas Potiguares é fictícia; nenhum pagamento real é processado.
          </p>
          <p>
            Bazar Solidário Digital — Projeto de Extensão V, Sistemas de Informação, UNI-RN (Grupo
            1): Edmundo Cabral, Rafael Alves, Guilherme e Luiz Augusto.
          </p>
        </div>
        <ul className="space-y-1 sm:text-right">
          <li>
            <Link className="hover:underline" href="/transparencia">
              Prestação de contas
            </Link>
          </li>
          <li>
            <Link className="hover:underline" href="/suporte">
              Central de atendimento
            </Link>
          </li>
          <li>
            <Link className="hover:underline" href="/adote/acompanhar">
              Acompanhar adoção
            </Link>
          </li>
          <li>
            <Link className="hover:underline" href="/admin">
              Área da equipe
            </Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}
