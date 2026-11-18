import { Badge, type BadgeTone } from './ui/badge';
import {
  ADOPTION_STATUS,
  ANIMAL_STATUS,
  ORDER_STATUS,
  PAYMENT_STATUS,
  PRIORITIES,
  SLA_STATE,
  SPONSORSHIP_STATUS,
  TICKET_STATUS,
} from '@/lib/labels';

const MAPS: Record<string, { labels: Record<string, string>; tones: Record<string, BadgeTone> }> = {
  order: {
    labels: ORDER_STATUS,
    tones: {
      PENDING_PAYMENT: 'warning',
      PAID: 'success',
      SHIPPED: 'info',
      DELIVERED: 'success',
      CANCELED: 'danger',
    },
  },
  payment: {
    labels: PAYMENT_STATUS,
    tones: {
      PENDING: 'warning',
      APPROVED: 'success',
      REJECTED: 'danger',
      REFUNDED: 'neutral',
      CANCELED: 'danger',
    },
  },
  animal: {
    labels: ANIMAL_STATUS,
    tones: { AVAILABLE: 'success', IN_ADOPTION: 'info', ADOPTED: 'neutral' },
  },
  adoption: {
    labels: ADOPTION_STATUS,
    tones: {
      RECEIVED: 'neutral',
      IN_REVIEW: 'info',
      INTERVIEW: 'warning',
      APPROVED: 'success',
      REJECTED: 'danger',
    },
  },
  sponsorship: {
    labels: SPONSORSHIP_STATUS,
    tones: { PENDING: 'warning', ACTIVE: 'success', PAUSED: 'neutral', CANCELED: 'danger' },
  },
  ticket: {
    labels: TICKET_STATUS,
    tones: {
      OPEN: 'warning',
      IN_PROGRESS: 'info',
      WAITING_USER: 'neutral',
      RESOLVED: 'success',
      CLOSED: 'neutral',
    },
  },
  priority: {
    labels: PRIORITIES,
    tones: { P1: 'danger', P2: 'warning', P3: 'info', P4: 'neutral' },
  },
  sla: {
    labels: SLA_STATE,
    tones: { ON_TRACK: 'success', AT_RISK: 'warning', VIOLATED: 'danger', MET: 'success' },
  },
};

export function StatusBadge({ kind, value }: { kind: keyof typeof MAPS; value: string }) {
  const map = MAPS[kind]!;
  return <Badge tone={map.tones[value] ?? 'neutral'}>{map.labels[value] ?? value}</Badge>;
}
