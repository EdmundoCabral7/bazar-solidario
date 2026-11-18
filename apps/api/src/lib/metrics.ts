/** Contadores simples em memória, expostos em GET /metrics. */
const http = { requestsTotal: 0, responses2xx: 0, responses4xx: 0, responses5xx: 0 };
const counters = new Map<string, number>();
const breakerStates = new Map<string, () => string>();
const startedAt = Date.now();

export function recordResponse(statusCode: number) {
  http.requestsTotal += 1;
  if (statusCode >= 500) http.responses5xx += 1;
  else if (statusCode >= 400) http.responses4xx += 1;
  else http.responses2xx += 1;
}

/** Incrementa um contador nomeado (ex.: 'webhooks.received', 'external.viacep.failure'). */
export function increment(name: string, by = 1) {
  counters.set(name, (counters.get(name) ?? 0) + by);
}

export function registerBreaker(name: string, getState: () => string) {
  breakerStates.set(name, getState);
}

export function snapshot() {
  return {
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    ...http,
    counters: Object.fromEntries([...counters.entries()].sort()),
    circuitBreakers: Object.fromEntries([...breakerStates.entries()].map(([k, f]) => [k, f()])),
    memoryRssBytes: process.memoryUsage().rss,
  };
}
