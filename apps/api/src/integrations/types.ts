/**
 * Contratos das integrações externas. Cada provedor tem uma implementação real (sandbox/REST)
 * e uma mock; a escolha é feita em registry.ts conforme INTEGRATIONS_MODE.
 */

export type IntegrationMode = 'mock' | 'sandbox' | 'real';

export interface IntegrationHealth {
  name: string;
  mode: IntegrationMode;
  status: 'up' | 'down' | 'degraded';
  circuit?: 'closed' | 'open' | 'halfOpen';
  detail?: string;
}

export interface HealthCheckable {
  readonly name: string;
  readonly mode: IntegrationMode;
  health(): Promise<IntegrationHealth>;
}

// ---------- I01 — Mercado Pago ----------

/** Status normalizados do gateway (equivalem ao enum PaymentStatus do banco). */
export type GatewayPaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFUNDED' | 'CANCELED';

export interface CreatePixChargeInput {
  amountCents: number;
  description: string;
  payerEmail: string;
  idempotencyKey: string;
  /** Referência interna (id do Payment) enviada ao gateway. */
  externalReference: string;
}
export interface PixCharge {
  externalId: string;
  status: GatewayPaymentStatus;
  /** Código "copia e cola" (EMV). */
  copyPaste: string;
  /** PNG do QR Code em base64 (o sandbox gera; o mock não, e o portal renderiza a partir do copia-e-cola). */
  qrCodeBase64: string | null;
  expiresAt: Date;
  raw: unknown;
}

export interface CreateCardPaymentInput {
  amountCents: number;
  description: string;
  payerEmail: string;
  cardToken: string;
  paymentMethodId: string;
  installments: number;
  idempotencyKey: string;
  externalReference: string;
}
export interface CardPayment {
  externalId: string;
  status: GatewayPaymentStatus;
  statusDetail?: string;
  raw: unknown;
}

export interface GatewayPayment {
  externalId: string;
  status: GatewayPaymentStatus;
  amountCents: number;
  externalReference?: string;
}

export interface CreateSubscriptionInput {
  amountCents: number;
  reason: string;
  payerEmail: string;
  externalReference: string;
  backUrl: string;
  idempotencyKey: string;
}
export type GatewaySubscriptionStatus = 'PENDING' | 'ACTIVE' | 'PAUSED' | 'CANCELED';
export interface GatewaySubscription {
  externalId: string;
  status: GatewaySubscriptionStatus;
  externalReference?: string;
  checkoutUrl?: string;
}
export interface GatewayAuthorizedPayment {
  externalId: string;
  subscriptionId: string;
  status: GatewayPaymentStatus;
  amountCents: number;
}

export interface PaymentProvider extends HealthCheckable {
  createPixCharge(input: CreatePixChargeInput): Promise<PixCharge>;
  createCardPayment(input: CreateCardPaymentInput): Promise<CardPayment>;
  getPayment(externalId: string): Promise<GatewayPayment>;
  createSubscription(input: CreateSubscriptionInput): Promise<GatewaySubscription>;
  getSubscription(externalId: string): Promise<GatewaySubscription>;
  cancelSubscription(externalId: string): Promise<void>;
  getAuthorizedPayment(externalId: string): Promise<GatewayAuthorizedPayment>;
}

// ---------- I02 — Melhor Envio ----------

export interface ShippingPackage {
  weightGrams: number;
  heightCm: number;
  widthCm: number;
  lengthCm: number;
}
export interface ShippingQuote {
  service: string;
  company: string;
  priceCents: number;
  deliveryDays: number;
}
export interface ShippingProvider extends HealthCheckable {
  quote(params: { toCep: string; pkg: ShippingPackage }): Promise<ShippingQuote[]>;
}

// ---------- I03 — ViaCEP ----------

export interface Address {
  cep: string;
  street: string;
  district: string;
  city: string;
  state: string;
}
export interface CepProvider extends HealthCheckable {
  /** null quando o CEP não existe. */
  lookup(cep: string): Promise<Address | null>;
}

// ---------- I04 — Notificações ----------

export interface NotificationMessage {
  to: string;
  /** Texto final já renderizado (pt-BR). */
  body: string;
  subject?: string;
}
export interface NotificationProvider extends HealthCheckable {
  readonly channel: 'WHATSAPP' | 'EMAIL';
  send(message: NotificationMessage): Promise<{ messageId: string }>;
}
