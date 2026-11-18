import type { GatewayPaymentStatus, GatewaySubscriptionStatus } from '../types';

/** Converte status de pagamento do Mercado Pago para o status interno. */
export function mapMpPaymentStatus(status: string | undefined): GatewayPaymentStatus {
  switch (status) {
    case 'approved':
    case 'authorized':
    case 'processed':
      return 'APPROVED';
    case 'rejected':
    case 'recycling':
      return 'REJECTED';
    case 'cancelled':
      return 'CANCELED';
    case 'refunded':
    case 'charged_back':
      return 'REFUNDED';
    default: // pending, in_process, in_mediation, scheduled
      return 'PENDING';
  }
}

export function mapMpSubscriptionStatus(status: string | undefined): GatewaySubscriptionStatus {
  switch (status) {
    case 'authorized':
      return 'ACTIVE';
    case 'paused':
      return 'PAUSED';
    case 'cancelled':
      return 'CANCELED';
    default:
      return 'PENDING';
  }
}

export const toCents = (amount: number | undefined) => Math.round((amount ?? 0) * 100);
export const toReais = (cents: number) => Math.round(cents) / 100;
