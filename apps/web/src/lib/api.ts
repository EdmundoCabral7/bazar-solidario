import type { ApiErrorBody } from '@bazar/shared';

/** URL da API: no servidor pode usar API_URL (rede interna); no navegador, NEXT_PUBLIC_API_URL. */
export const API_URL =
  (typeof window === 'undefined' ? process.env.API_URL : undefined) ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3333';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

type FetchInit = RequestInit & { token?: string | null; idempotencyKey?: string };

/** Cliente HTTP da API. Lança ApiError com a mensagem em pt-BR vinda do backend. */
export async function apiFetch<T>(path: string, init: FetchInit = {}): Promise<T> {
  const { token, idempotencyKey, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        ...(rest.body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
        ...headers,
      },
    });
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Não foi possível conectar ao servidor. Verifique sua conexão.',
    );
  }
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(
      res.status,
      body?.error.code ?? 'UNKNOWN',
      body?.error.message ?? 'Erro inesperado. Tente novamente.',
      body?.error.details,
    );
  }
  return res.json() as Promise<T>;
}

export const post = <T>(path: string, body: unknown, init: FetchInit = {}) =>
  apiFetch<T>(path, { ...init, method: 'POST', body: JSON.stringify(body) });
export const patch = <T>(path: string, body: unknown, init: FetchInit = {}) =>
  apiFetch<T>(path, { ...init, method: 'PATCH', body: JSON.stringify(body) });

/** Busca no servidor (Server Components) devolvendo null em caso de erro, para a página degradar com elegância. */
export async function serverGet<T>(path: string, revalidate = 30): Promise<T | null> {
  try {
    return await apiFetch<T>(path, { next: { revalidate } });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    console.error(`[portal] falha ao buscar ${path}:`, (err as Error).message);
    return null;
  }
}

/** Monta query string ignorando valores vazios. */
export function qs(params: Record<string, string | number | undefined | null>) {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))}` : '';
}

export function errorMessage(err: unknown) {
  return err instanceof ApiError ? err.message : 'Erro inesperado. Tente novamente.';
}
