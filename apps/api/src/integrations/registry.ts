import { env } from '../config/env';
import type { HealthCheckable, IntegrationHealth } from './types';

/**
 * Registro das integrações ativas, usado pelo /health.
 * Na Fase 1 apenas declara os provedores previstos (I01–I04) como stubs mock.
 */
const planned = ['mercadopago', 'melhorenvio', 'viacep', 'whatsapp'] as const;

const stubs: HealthCheckable[] = planned.map((name) => ({
  name,
  async health(): Promise<IntegrationHealth> {
    return { name, mode: env.INTEGRATIONS_MODE, status: 'up', detail: 'não implementada (Fase 2)' };
  },
}));

export function getIntegrations(): HealthCheckable[] {
  return stubs;
}
