import { randomInt } from 'node:crypto';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import type {
  CardPayment,
  CreateCardPaymentInput,
  CreatePixChargeInput,
  CreateSubscriptionInput,
  GatewayAuthorizedPayment,
  GatewayPayment,
  GatewayPaymentStatus,
  GatewaySubscription,
  GatewaySubscriptionStatus,
  IntegrationHealth,
  PaymentProvider,
  PixCharge,
} from '../types';

/** Tokens de cartão especiais do mock (para demonstrar recusa). */
export const MOCK_CARD_REJECTED = 'mock-card-rejected';
export const MOCK_CARD_PENDING = 'mock-card-pending';

interface MockPayment extends GatewayPayment {
  idempotencyKey: string;
}

/**
 * Gateway de pagamento em memória. Simula Pix, cartão e assinaturas sem rede.
 * O estado é perdido ao reiniciar; o simulador de dev reidrata o que precisar.
 */
export class MockMercadoPagoProvider implements PaymentProvider {
  readonly name = 'mercadopago';
  readonly mode = 'mock' as const;
  private payments = new Map<string, MockPayment>();
  private subscriptions = new Map<string, GatewaySubscription & { amountCents: number }>();
  private authorizedPayments = new Map<string, GatewayAuthorizedPayment>();
  private byIdempotencyKey = new Map<string, string>();

  private nextId() {
    return String(randomInt(10_000_000, 99_999_999)) + String(randomInt(1000, 9999));
  }

  private idempotent<T extends { externalId: string }>(key: string, create: () => T): T {
    const existing = this.byIdempotencyKey.get(key);
    if (existing) return this.payments.get(existing) as unknown as T;
    const created = create();
    this.byIdempotencyKey.set(key, created.externalId);
    return created;
  }

  async createPixCharge(input: CreatePixChargeInput): Promise<PixCharge> {
    const p = this.idempotent(input.idempotencyKey, () => {
      const externalId = this.nextId();
      const payment: MockPayment = {
        externalId,
        status: 'PENDING',
        amountCents: input.amountCents,
        externalReference: input.externalReference,
        idempotencyKey: input.idempotencyKey,
      };
      this.payments.set(externalId, payment);
      return payment;
    });
    const amount = (input.amountCents / 100).toFixed(2);
    logger.info(
      { externalId: p.externalId, amountCents: input.amountCents },
      '[mock MP] cobrança Pix criada',
    );
    return {
      externalId: p.externalId,
      status: p.status,
      copyPaste:
        `00020126580014BR.GOV.BCB.PIX0136mock-patas-potiguares-${p.externalId}` +
        `520400005303986540${amount.length}${amount}5802BR5916PATAS POTIGUARES6005NATAL62070503***6304MOCK`,
      qrCodeBase64: null,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      raw: { mock: true, id: p.externalId },
    };
  }

  async createCardPayment(input: CreateCardPaymentInput): Promise<CardPayment> {
    const p = this.idempotent(input.idempotencyKey, () => {
      const status: GatewayPaymentStatus =
        input.cardToken === MOCK_CARD_REJECTED
          ? 'REJECTED'
          : input.cardToken === MOCK_CARD_PENDING
            ? 'PENDING'
            : 'APPROVED';
      const payment: MockPayment = {
        externalId: this.nextId(),
        status,
        amountCents: input.amountCents,
        externalReference: input.externalReference,
        idempotencyKey: input.idempotencyKey,
      };
      this.payments.set(payment.externalId, payment);
      return payment;
    });
    logger.info({ externalId: p.externalId, status: p.status }, '[mock MP] pagamento com cartão');
    return {
      externalId: p.externalId,
      status: p.status,
      statusDetail: p.status === 'REJECTED' ? 'cc_rejected_other_reason' : 'accredited',
      raw: { mock: true, id: p.externalId },
    };
  }

  async getPayment(externalId: string): Promise<GatewayPayment> {
    const p = this.payments.get(externalId);
    if (!p) throw new Error(`[mock MP] pagamento ${externalId} não encontrado`);
    return {
      externalId,
      status: p.status,
      amountCents: p.amountCents,
      externalReference: p.externalReference,
    };
  }

  /** Simulador: define o status de um pagamento (criando-o se o mock foi reiniciado). */
  setPaymentStatus(
    externalId: string,
    status: GatewayPaymentStatus,
    fallback: { amountCents: number; externalReference: string },
  ) {
    const p = this.payments.get(externalId) ?? {
      externalId,
      idempotencyKey: `rehydrated-${externalId}`,
      status: 'PENDING' as const,
      ...fallback,
    };
    this.payments.set(externalId, { ...p, status });
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<GatewaySubscription> {
    const externalId = `mock-sub-${this.nextId()}`;
    const sub = {
      externalId,
      status: 'PENDING' as const,
      externalReference: input.externalReference,
      amountCents: input.amountCents,
      // no mock, o "checkout" é uma página do próprio portal
      checkoutUrl: `${env.WEB_URL}/doe/apadrinhar/checkout-simulado?id=${input.externalReference}`,
    };
    this.subscriptions.set(externalId, sub);
    logger.info({ externalId }, '[mock MP] assinatura criada');
    return sub;
  }

  async getSubscription(externalId: string): Promise<GatewaySubscription> {
    const s = this.subscriptions.get(externalId);
    if (!s) throw new Error(`[mock MP] assinatura ${externalId} não encontrada`);
    return s;
  }

  async cancelSubscription(externalId: string): Promise<void> {
    const s = this.subscriptions.get(externalId);
    if (s) s.status = 'CANCELED';
  }

  setSubscriptionStatus(
    externalId: string,
    status: GatewaySubscriptionStatus,
    fallback: { amountCents: number; externalReference: string },
  ) {
    const s = this.subscriptions.get(externalId) ?? { externalId, status, ...fallback };
    this.subscriptions.set(externalId, { ...s, status });
  }

  /** Simulador: gera uma cobrança mensal aprovada da assinatura. */
  chargeSubscription(subscriptionId: string, amountCents: number): GatewayAuthorizedPayment {
    const ap: GatewayAuthorizedPayment = {
      externalId: `mock-ap-${this.nextId()}`,
      subscriptionId,
      status: 'APPROVED',
      amountCents,
    };
    this.authorizedPayments.set(ap.externalId, ap);
    return ap;
  }

  async getAuthorizedPayment(externalId: string): Promise<GatewayAuthorizedPayment> {
    const ap = this.authorizedPayments.get(externalId);
    if (!ap) throw new Error(`[mock MP] cobrança ${externalId} não encontrada`);
    return ap;
  }

  async health(): Promise<IntegrationHealth> {
    return { name: this.name, mode: this.mode, status: 'up', detail: 'simulador em memória' };
  }
}
