'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './api';
import type { Health } from './types';

/** true quando o gateway de pagamento está em modo mock (habilita os botões do simulador). */
export function useDemoMode() {
  const { data } = useQuery({
    queryKey: ['health'],
    queryFn: () => apiFetch<Health>('/health'),
    staleTime: 60_000,
  });
  return data?.integrations.find((i) => i.name === 'mercadopago')?.mode === 'mock';
}
