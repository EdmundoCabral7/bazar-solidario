import { env } from '../config/env';
import { logger } from '../lib/logger';
import { MockMercadoPagoProvider } from './mercadopago/mock';
import { SandboxMercadoPagoProvider } from './mercadopago/sandbox';
import { MockShippingProvider } from './melhorenvio/mock';
import { SandboxShippingProvider } from './melhorenvio/sandbox';
import {
  CloudWhatsAppProvider,
  MockEmailProvider,
  MockWhatsAppProvider,
  whatsappConfigured,
} from './notifications/providers';
import type {
  CepProvider,
  HealthCheckable,
  IntegrationHealth,
  NotificationProvider,
  PaymentProvider,
  ShippingProvider,
} from './types';
import { MockCepProvider, ViaCepProvider } from './viacep/viacep';

export interface Integrations {
  payment: PaymentProvider;
  shipping: ShippingProvider;
  cep: CepProvider;
  whatsapp: NotificationProvider;
  email: NotificationProvider;
}

function build(): Integrations {
  const sandbox = env.INTEGRATIONS_MODE === 'sandbox';
  const integrations: Integrations = {
    payment:
      sandbox && env.MERCADOPAGO_ACCESS_TOKEN
        ? new SandboxMercadoPagoProvider(env.MERCADOPAGO_ACCESS_TOKEN)
        : new MockMercadoPagoProvider(),
    shipping:
      sandbox && env.MELHORENVIO_TOKEN
        ? new SandboxShippingProvider(env.MELHORENVIO_TOKEN)
        : new MockShippingProvider(),
    cep:
      env.VIACEP_MODE === 'real' && env.NODE_ENV !== 'test'
        ? new ViaCepProvider()
        : new MockCepProvider(),
    whatsapp:
      whatsappConfigured() && env.NODE_ENV !== 'test'
        ? new CloudWhatsAppProvider(env.WHATSAPP_TOKEN!, env.WHATSAPP_PHONE_NUMBER_ID!)
        : new MockWhatsAppProvider(),
    email: new MockEmailProvider(),
  };
  logger.info(
    Object.fromEntries(
      Object.entries(integrations).map(([k, v]) => [k, (v as HealthCheckable).mode]),
    ),
    'integrações carregadas',
  );
  return integrations;
}

let current: Integrations | undefined;

export function integrations(): Integrations {
  current ??= build();
  return current;
}

/** Substitui integrações (testes). */
export function overrideIntegrations(partial: Partial<Integrations>) {
  current = { ...integrations(), ...partial };
}

export function resetIntegrations() {
  current = undefined;
}

export async function integrationsHealth(): Promise<IntegrationHealth[]> {
  return Promise.all(Object.values(integrations()).map((i: HealthCheckable) => i.health()));
}

/** Mock do Mercado Pago, se ativo (usado pelo simulador de pagamentos). */
export function mockPaymentProvider(): MockMercadoPagoProvider | null {
  const p = integrations().payment;
  return p instanceof MockMercadoPagoProvider ? p : null;
}
