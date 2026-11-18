import * as React from 'react';
import { cn } from '@/lib/utils';

/** Select nativo estilizado (acessível e leve em celulares). */
export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm disabled:opacity-50 aria-[invalid=true]:border-destructive',
        className,
      )}
      {...props}
    />
  );
}
