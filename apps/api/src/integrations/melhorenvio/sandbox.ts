import { env } from '../../config/env';
import { fetchJson } from '../../lib/http';
import { ResilientExecutor } from '../../lib/resilience';
import type { IntegrationHealth, ShippingPackage, ShippingProvider, ShippingQuote } from '../types';

interface MeQuote {
  id: number;
  name: string;
  price?: string;
  custom_price?: string;
  delivery_time?: number;
  custom_delivery_time?: number;
  error?: string;
  company?: { name: string };
}

/** Cotação de frete no sandbox do Melhor Envio (REST + token OAuth2 pessoal). */
export class SandboxShippingProvider implements ShippingProvider {
  readonly name = 'melhorenvio';
  readonly mode = 'sandbox' as const;
  readonly executor = new ResilientExecutor('melhorenvio');
  private readonly baseUrl = 'https://sandbox.melhorenvio.com.br/api/v2';

  constructor(private readonly token: string) {}

  async quote({ toCep, pkg }: { toCep: string; pkg: ShippingPackage }): Promise<ShippingQuote[]> {
    const res = await this.executor.execute('quote', () =>
      fetchJson<MeQuote[]>('melhorenvio', `${this.baseUrl}/me/shipment/calculate`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.token}`,
          'user-agent': env.MELHORENVIO_USER_AGENT,
        },
        body: JSON.stringify({
          from: { postal_code: env.MELHORENVIO_FROM_CEP },
          to: { postal_code: toCep },
          package: {
            weight: pkg.weightGrams / 1000,
            height: pkg.heightCm,
            width: pkg.widthCm,
            length: pkg.lengthCm,
          },
        }),
      }),
    );
    return res
      .filter((q) => !q.error && (q.custom_price ?? q.price))
      .map((q) => ({
        service: q.name,
        company: q.company?.name ?? 'Transportadora',
        priceCents: Math.round(Number(q.custom_price ?? q.price) * 100),
        deliveryDays: q.custom_delivery_time ?? q.delivery_time ?? 0,
      }));
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
