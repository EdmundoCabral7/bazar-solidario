import { fetchJson } from '../../lib/http';
import { increment } from '../../lib/metrics';
import { ResilientExecutor } from '../../lib/resilience';
import type { Address, CepProvider, IntegrationHealth } from '../types';

interface ViaCepResponse {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean | string;
}

/** Cache em memória com TTL (CEPs mudam raramente). */
class TtlCache<V> {
  private store = new Map<string, { value: V; expiresAt: number }>();
  constructor(private readonly maxEntries = 5000) {}
  get(key: string): V | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }
  set(key: string, value: V, ttlMs: number) {
    if (this.store.size >= this.maxEntries)
      this.store.delete(this.store.keys().next().value as string);
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
}

const DAY = 24 * 60 * 60 * 1000;

/** ViaCEP real (API pública, sem chave) com cache de 24 h (CEP inexistente: 1 h). */
export class ViaCepProvider implements CepProvider {
  readonly name = 'viacep';
  readonly mode = 'real' as const;
  readonly executor = new ResilientExecutor('viacep', { timeoutMs: 3000 });
  private cache = new TtlCache<Address | null>();

  async lookup(cep: string): Promise<Address | null> {
    const cached = this.cache.get(cep);
    if (cached !== undefined) {
      increment('viacep.cache.hit');
      return cached;
    }
    increment('viacep.cache.miss');
    const res = await this.executor.execute('lookup', () =>
      fetchJson<ViaCepResponse>('viacep', `https://viacep.com.br/ws/${cep}/json/`),
    );
    const address = res.erro
      ? null
      : { cep, street: res.logradouro, district: res.bairro, city: res.localidade, state: res.uf };
    this.cache.set(cep, address, address ? DAY : DAY / 24);
    return address;
  }

  async health(): Promise<IntegrationHealth> {
    const circuit = this.executor.state;
    return {
      name: this.name,
      mode: this.mode,
      circuit,
      status: circuit === 'open' ? 'down' : circuit === 'halfOpen' ? 'degraded' : 'up',
    };
  }
}

/** ViaCEP offline: qualquer CEP 59xxx-xxx é de Natal/RN; 00000-000 não existe. */
export class MockCepProvider implements CepProvider {
  readonly name = 'viacep';
  readonly mode = 'mock' as const;

  async lookup(cep: string): Promise<Address | null> {
    if (/^0+$/.test(cep)) return null;
    if (cep.startsWith('59')) {
      return {
        cep,
        street: 'Avenida Engenheiro Roberto Freire',
        district: 'Ponta Negra',
        city: 'Natal',
        state: 'RN',
      };
    }
    return {
      cep,
      street: 'Rua Simulada',
      district: 'Centro',
      city: 'Cidade Simulada',
      state: 'SP',
    };
  }

  async health(): Promise<IntegrationHealth> {
    return { name: this.name, mode: this.mode, status: 'up', detail: 'endereços simulados' };
  }
}
