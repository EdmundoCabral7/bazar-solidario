/** Contadores simples em memória, expostos em GET /metrics. */
const counters = {
  requestsTotal: 0,
  responses2xx: 0,
  responses4xx: 0,
  responses5xx: 0,
};
const startedAt = Date.now();

export function recordResponse(statusCode: number) {
  counters.requestsTotal += 1;
  if (statusCode >= 500) counters.responses5xx += 1;
  else if (statusCode >= 400) counters.responses4xx += 1;
  else counters.responses2xx += 1;
}

export function snapshot() {
  return {
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    ...counters,
    memoryRssBytes: process.memoryUsage().rss,
  };
}
