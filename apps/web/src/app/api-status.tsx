'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

interface Health {
  status: 'ok' | 'degraded';
  database: { status: 'up' | 'down' };
}

/** Indicador discreto de conexão com a API (útil em desenvolvimento e na demonstração). */
export function ApiStatus() {
  const { data, isError, isLoading } = useQuery({
    queryKey: ['health'],
    queryFn: () => apiFetch<Health>('/health'),
  });
  const label = isLoading
    ? 'Verificando API…'
    : isError
      ? 'API indisponível'
      : data?.status === 'ok'
        ? 'API e banco operacionais'
        : 'API com degradação';
  const color = isLoading
    ? 'bg-muted-foreground'
    : !isError && data?.status === 'ok'
      ? 'bg-green-600'
      : 'bg-destructive';
  return (
    <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
      <span aria-hidden className={`inline-block size-2 rounded-full ${color}`} />
      {label}
    </p>
  );
}
