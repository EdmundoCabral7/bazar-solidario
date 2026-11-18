import { env } from '../config/env';
import { ExternalServiceError } from './resilience';
import { getCorrelationId } from './request-context';

/**
 * fetch JSON para integrações: timeout, repasse do x-correlation-id e conversão de erros
 * em ExternalServiceError (5xx/429 retentáveis; demais 4xx não).
 */
export async function fetchJson<T>(
  service: string,
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs, headers, ...rest } = init;
  const correlationId = getCorrelationId();
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      signal: AbortSignal.timeout(timeoutMs ?? env.HTTP_TIMEOUT_MS),
      headers: {
        accept: 'application/json',
        ...(rest.body ? { 'content-type': 'application/json' } : {}),
        ...(correlationId ? { 'x-correlation-id': correlationId } : {}),
        ...headers,
      },
    });
  } catch (err) {
    throw new ExternalServiceError(
      service,
      `Falha de rede ao chamar ${service}: ${(err as Error).message}`,
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const retryable = res.status >= 500 || res.status === 429;
    throw new ExternalServiceError(
      service,
      `${service} respondeu ${res.status}: ${text.slice(0, 200)}`,
      retryable,
      res.status,
    );
  }
  return (await res.json()) as T;
}
