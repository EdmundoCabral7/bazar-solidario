/**
 * Contratos das integrações externas (implementações reais e mocks na Fase 2).
 * A implementação é escolhida por INTEGRATIONS_MODE=mock|sandbox.
 */

export interface IntegrationHealth {
  name: string;
  mode: 'mock' | 'sandbox';
  status: 'up' | 'down' | 'degraded';
  detail?: string;
}

export interface HealthCheckable {
  readonly name: string;
  health(): Promise<IntegrationHealth>;
}

// I01 — Mercado Pago
export interface CreatePixChargeInput {
  amountCents: number;
  description: string;
  payerEmail: string;
  idempotencyKey: string;
  externalReference: string;
}
export interface PixCharge {
  externalId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  qrCodeBase64: string;
  copyPaste: string;
  expiresAt: Date;
}
export interface CreateSubscriptionInput {
  amountCents: number;
  reason: string;
  payerEmail: string;
  externalReference: string;
}
export interface Subscription {
  externalId: string;
  status: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'CANCELED';
  checkoutUrl?: string;
}
export interface PaymentProvider extends HealthCheckable {
  createPixCharge(input: CreatePixChargeInput): Promise<PixCharge>;
  getPayment(
    externalId: string,
  ): Promise<{ externalId: string; status: string; amountCents: number }>;
  createSubscription(input: CreateSubscriptionInput): Promise<Subscription>;
  cancelSubscription(externalId: string): Promise<void>;
  verifyWebhookSignature(params: { signature: string; requestId: string; dataId: string }): boolean;
}

// I02 — Melhor Envio
export interface ShippingQuote {
  service: string;
  priceCents: number;
  deliveryDays: number;
}
export interface ShippingProvider extends HealthCheckable {
  quote(params: { toCep: string; weightGrams: number }): Promise<ShippingQuote[]>;
}

// I03 — ViaCEP
export interface Address {
  cep: string;
  street: string;
  district: string;
  city: string;
  state: string;
}
export interface CepProvider extends HealthCheckable {
  lookup(cep: string): Promise<Address | null>;
}

// I04 — WhatsApp Cloud API / e-mail
export interface NotificationMessage {
  to: string;
  template: string;
  variables: Record<string, string>;
}
export interface NotificationProvider extends HealthCheckable {
  send(message: NotificationMessage): Promise<{ messageId: string }>;
}
