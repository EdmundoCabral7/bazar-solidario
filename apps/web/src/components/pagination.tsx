import Link from 'next/link';
import { cn } from '@/lib/utils';

/** Paginação por links (funciona sem JavaScript). */
export function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (p: number) => string;
}) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  return (
    <nav aria-label="Paginação" className="mt-8 flex flex-wrap justify-center gap-1">
      {pages.map((p) => (
        <Link
          key={p}
          href={hrefFor(p)}
          aria-current={p === page ? 'page' : undefined}
          className={cn(
            'min-w-10 rounded-md border border-border px-3 py-2 text-center text-sm',
            p === page ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
          )}
        >
          {p}
        </Link>
      ))}
    </nav>
  );
}
