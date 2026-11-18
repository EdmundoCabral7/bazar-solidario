import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContext {
  correlationId: string;
}

/** Contexto por requisição: permite repassar o correlationId às chamadas externas. */
export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getCorrelationId(): string | undefined {
  return requestContext.getStore()?.correlationId;
}
