import CircuitBreaker from 'opossum';
import { env } from '../config/env';
import { logger } from './logger';
import { increment, registerBreaker } from './metrics';

/** Erro de integração externa. `retryable=false` para erros do cliente (4xx), que não adianta repetir. */
export class ExternalServiceError extends Error {
  constructor(
    public readonly service: string,
    message: string,
    public readonly retryable = true,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ExternalServiceError';
  }
}

export interface ResilienceOptions {
  /** Timeout de cada tentativa (ms). */
  timeoutMs?: number;
  /** Tentativas extras após a primeira. */
  retries?: number;
  /** Atraso base do backoff exponencial (ms). */
  baseDelayMs?: number;
  /** % de falhas que abre o circuito. */
  errorThresholdPercentage?: number;
  /** Tempo com o circuito aberto antes de testar de novo (ms). */
  resetTimeoutMs?: number;
}

export type CircuitState = 'closed' | 'open' | 'halfOpen';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Backoff exponencial com jitter: base * 2^tentativa ± 20%. */
export function backoffDelay(attempt: number, baseMs: number): number {
  const exp = baseMs * 2 ** attempt;
  return Math.round(exp * (0.8 + Math.random() * 0.4));
}

/**
 * Executor resiliente de uma integração: cada tentativa passa por um circuit breaker (opossum,
 * com timeout); falhas transitórias são repetidas com backoff exponencial. Circuito aberto e
 * erros não-retentáveis falham imediatamente.
 */
export class ResilientExecutor {
  private readonly breaker: CircuitBreaker<[() => Promise<unknown>], unknown>;
  private readonly retries: number;
  private readonly baseDelayMs: number;

  constructor(
    public readonly name: string,
    opts: ResilienceOptions = {},
  ) {
    this.retries = opts.retries ?? 2;
    this.baseDelayMs = opts.baseDelayMs ?? (env.NODE_ENV === 'test' ? 1 : 200);
    this.breaker = new CircuitBreaker((fn: () => Promise<unknown>) => fn(), {
      name,
      timeout: opts.timeoutMs ?? env.HTTP_TIMEOUT_MS,
      errorThresholdPercentage: opts.errorThresholdPercentage ?? 50,
      resetTimeout: opts.resetTimeoutMs ?? 30_000,
      volumeThreshold: 5,
      // erros do cliente (4xx) não contam como falha do serviço
      errorFilter: (err: unknown) => err instanceof ExternalServiceError && !err.retryable,
    });
    this.breaker.on('open', () => logger.warn({ integration: name }, 'circuit breaker ABERTO'));
    this.breaker.on('halfOpen', () =>
      logger.info({ integration: name }, 'circuit breaker MEIO-ABERTO'),
    );
    this.breaker.on('close', () => logger.info({ integration: name }, 'circuit breaker FECHADO'));
    registerBreaker(name, () => this.state);
  }

  get state(): CircuitState {
    if (this.breaker.opened) return 'open';
    if (this.breaker.halfOpen) return 'halfOpen';
    return 'closed';
  }

  async execute<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    let attempt = 0;
    for (;;) {
      const started = Date.now();
      try {
        const result = (await this.breaker.fire(fn)) as T;
        increment(`external.${this.name}.success`);
        logger.debug(
          { integration: this.name, operation, ms: Date.now() - started },
          'chamada externa ok',
        );
        return result;
      } catch (err) {
        increment(`external.${this.name}.failure`);
        const e = err as Error & { code?: string };
        const open = e.code === 'EOPENBREAKER';
        const retryable = !open && !(err instanceof ExternalServiceError && !err.retryable);
        logger.warn(
          { integration: this.name, operation, attempt, err: e.message, retryable },
          'falha em chamada externa',
        );
        if (!retryable || attempt >= this.retries) {
          if (open) {
            throw new ExternalServiceError(
              this.name,
              `Serviço ${this.name} temporariamente indisponível`,
              true,
            );
          }
          if (e.code === 'ETIMEDOUT') {
            throw new ExternalServiceError(
              this.name,
              `Tempo esgotado ao chamar ${this.name}`,
              true,
            );
          }
          throw err;
        }
        increment(`external.${this.name}.retry`);
        await sleep(backoffDelay(attempt, this.baseDelayMs));
        attempt += 1;
      }
    }
  }

  /** Para testes. */
  reset() {
    this.breaker.close();
  }
}
