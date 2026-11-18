import { MercadoPagoConfig, Payment, PreApproval } from 'mercadopago';
import { env } from '../../config/env';
import { fetchJson } from '../../lib/http';
import { getCorrelationId } from '../../lib/request-context';
import { ExternalServiceError, ResilientExecutor } from '../../lib/resilience';
import type {
  CardPayment,
  CreateCardPaymentInput,
  CreatePixChargeInput,
  CreateSubscriptionInput,
  GatewayAuthorizedPayment,
  GatewayPayment,
  GatewaySubscription,
  IntegrationHealth,
  PaymentProvider,
  PixCharge,
} from '../types';
import { mapMpPaymentStatus, mapMpSubscriptionStatus, toCents, toReais } from './status';

/** Converte erros do SDK em ExternalServiceError (4xx não são retentáveis). */
function wrap(err: unknown): never {
  const e = err as { status?: number; message?: string; cause?: unknown };
  const status = typeof e.status === 'number' ? e.status : undefined;
  const retryable = !status || status >= 500 || status === 429;
  throw new ExternalServiceError(
    'mercadopago',
    e.message ?? 'Erro no Mercado Pago',
    retryable,
    status,
  );
}

/**
 * Mercado Pago real (credenciais TEST- de sandbox) via SDK oficial `mercadopago`.
 * O SDK não aceita headers arbitrários, então o correlationId vai em `metadata`.
 */
export class SandboxMercadoPagoProvider implements PaymentProvider {
  readonly name = 'mercadopago';
  readonly mode = 'sandbox' as const;
  private readonly config: MercadoPagoConfig;
  private readonly payment: Payment;
  private readonly preApproval: PreApproval;
  readonly executor = new ResilientExecutor('mercadopago');

  constructor(private readonly accessToken: string) {
    this.config = new MercadoPagoConfig({ accessToken, options: { timeout: env.HTTP_TIMEOUT_MS } });
    this.payment = new Payment(this.config);
    this.preApproval = new PreApproval(this.config);
  }

  private notificationUrl() {
    return `${env.API_PUBLIC_URL}/api/webhooks/mercadopago`;
  }

  async createPixCharge(input: CreatePixChargeInput): Promise<PixCharge> {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const res = await this.executor.execute('createPixCharge', () =>
      this.payment
        .create({
          body: {
            transaction_amount: toReais(input.amountCents),
            description: input.description,
            payment_method_id: 'pix',
            payer: { email: input.payerEmail },
            external_reference: input.externalReference,
            notification_url: this.notificationUrl(),
            date_of_expiration: expiresAt.toISOString().replace('Z', '-00:00'),
            metadata: { correlation_id: getCorrelationId() },
          },
          requestOptions: { idempotencyKey: input.idempotencyKey },
        })
        .catch(wrap),
    );
    const tx = res.point_of_interaction?.transaction_data;
    return {
      externalId: String(res.id),
      status: mapMpPaymentStatus(res.status),
      copyPaste: tx?.qr_code ?? '',
      qrCodeBase64: tx?.qr_code_base64 ?? null,
      expiresAt,
      raw: { id: res.id, status: res.status, status_detail: res.status_detail },
    };
  }

  async createCardPayment(input: CreateCardPaymentInput): Promise<CardPayment> {
    const res = await this.executor.execute('createCardPayment', () =>
      this.payment
        .create({
          body: {
            transaction_amount: toReais(input.amountCents),
            description: input.description,
            token: input.cardToken,
            installments: input.installments,
            payment_method_id: input.paymentMethodId,
            payer: { email: input.payerEmail },
            external_reference: input.externalReference,
            notification_url: this.notificationUrl(),
            metadata: { correlation_id: getCorrelationId() },
          },
          requestOptions: { idempotencyKey: input.idempotencyKey },
        })
        .catch(wrap),
    );
    return {
      externalId: String(res.id),
      status: mapMpPaymentStatus(res.status),
      statusDetail: res.status_detail,
      raw: { id: res.id, status: res.status, status_detail: res.status_detail },
    };
  }

  async getPayment(externalId: string): Promise<GatewayPayment> {
    const res = await this.executor.execute('getPayment', () =>
      this.payment.get({ id: externalId }).catch(wrap),
    );
    return {
      externalId: String(res.id),
      status: mapMpPaymentStatus(res.status),
      amountCents: toCents(res.transaction_amount),
      externalReference: res.external_reference,
    };
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<GatewaySubscription> {
    const res = await this.executor.execute('createSubscription', () =>
      this.preApproval
        .create({
          body: {
            reason: input.reason,
            external_reference: input.externalReference,
            payer_email: input.payerEmail,
            back_url: input.backUrl,
            status: 'pending',
            auto_recurring: {
              frequency: 1,
              frequency_type: 'months',
              transaction_amount: toReais(input.amountCents),
              currency_id: 'BRL',
            },
          },
          requestOptions: { idempotencyKey: input.idempotencyKey },
        })
        .catch(wrap),
    );
    return {
      externalId: String(res.id),
      status: mapMpSubscriptionStatus(res.status),
      externalReference: res.external_reference,
      checkoutUrl: res.init_point,
    };
  }

  async getSubscription(externalId: string): Promise<GatewaySubscription> {
    const res = await this.executor.execute('getSubscription', () =>
      this.preApproval.get({ id: externalId }).catch(wrap),
    );
    return {
      externalId: String(res.id),
      status: mapMpSubscriptionStatus(res.status),
      externalReference: res.external_reference,
    };
  }

  async cancelSubscription(externalId: string): Promise<void> {
    await this.executor.execute('cancelSubscription', () =>
      this.preApproval.update({ id: externalId, body: { status: 'cancelled' } }).catch(wrap),
    );
  }

  /** Cobrança mensal da assinatura (sem cliente no SDK; REST direto). */
  async getAuthorizedPayment(externalId: string): Promise<GatewayAuthorizedPayment> {
    const res = await this.executor.execute('getAuthorizedPayment', () =>
      fetchJson<{
        id: number;
        preapproval_id: string;
        status: string;
        transaction_amount: number;
        payment?: { status?: string };
      }>(
        'mercadopago',
        `https://api.mercadopago.com/authorized_payments/${encodeURIComponent(externalId)}`,
        { headers: { authorization: `Bearer ${this.accessToken}` } },
      ),
    );
    return {
      externalId: String(res.id),
      subscriptionId: res.preapproval_id,
      status: mapMpPaymentStatus(res.payment?.status ?? res.status),
      amountCents: toCents(res.transaction_amount),
    };
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
