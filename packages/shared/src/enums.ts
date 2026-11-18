/** Enums de domínio compartilhados entre API e Web (espelham o schema Prisma). */
export const Roles = ['ADMIN', 'VOLUNTEER', 'SUPPORT_N2'] as const;
export type Role = (typeof Roles)[number];

export const Species = ['DOG', 'CAT'] as const;
export const AnimalSizes = ['SMALL', 'MEDIUM', 'LARGE'] as const;
export const Sexes = ['MALE', 'FEMALE'] as const;
export const AnimalStatuses = ['AVAILABLE', 'IN_ADOPTION', 'ADOPTED'] as const;
export const ProductConditions = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR'] as const;
export const ProductStatuses = ['ACTIVE', 'SOLD', 'HIDDEN'] as const;
export const OrderStatuses = [
  'PENDING_PAYMENT',
  'PAID',
  'SHIPPED',
  'DELIVERED',
  'CANCELED',
] as const;
export type OrderStatus = (typeof OrderStatuses)[number];
export const DeliveryTypes = ['PICKUP', 'SHIPPING'] as const;
export const SponsorshipPlans = ['P20', 'P50', 'P100'] as const;
export type SponsorshipPlan = (typeof SponsorshipPlans)[number];
export const SPONSORSHIP_PLAN_CENTS: Record<SponsorshipPlan, number> = {
  P20: 2000,
  P50: 5000,
  P100: 10000,
};
export const SponsorshipStatuses = ['PENDING', 'ACTIVE', 'PAUSED', 'CANCELED'] as const;
export const PaymentMethods = ['PIX', 'CARD'] as const;
export const PaymentStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'REFUNDED', 'CANCELED'] as const;
export type PaymentStatus = (typeof PaymentStatuses)[number];
export const AdoptionStatuses = [
  'RECEIVED',
  'IN_REVIEW',
  'INTERVIEW',
  'APPROVED',
  'REJECTED',
] as const;
export type AdoptionStatus = (typeof AdoptionStatuses)[number];
export const ExpenseCategories = [
  'RACAO',
  'VETERINARIO',
  'CASTRACAO',
  'MANUTENCAO',
  'OUTROS',
] as const;
export const TicketTypes = ['INCIDENT', 'SERVICE_REQUEST', 'PROBLEM'] as const;
export const ImpactLevels = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type ImpactLevel = (typeof ImpactLevels)[number];
export const UrgencyLevels = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type UrgencyLevel = (typeof UrgencyLevels)[number];
export const Priorities = ['P1', 'P2', 'P3', 'P4'] as const;
export type Priority = (typeof Priorities)[number];
export const SupportLevels = ['N1', 'N2', 'N3'] as const;
export type SupportLevel = (typeof SupportLevels)[number];
export const TicketStatuses = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_USER',
  'RESOLVED',
  'CLOSED',
] as const;
export type TicketStatus = (typeof TicketStatuses)[number];
export const ItServiceCodes = ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08'] as const;

/**
 * Matriz impacto × urgência (ITIL) → prioridade.
 *
 *              Urgência: ALTA  MÉDIA  BAIXA
 * Impacto ALTO          P1    P2     P3
 * Impacto MÉDIO         P2    P3     P4
 * Impacto BAIXO         P3    P4     P4
 */
const PRIORITY_MATRIX: Record<ImpactLevel, Record<UrgencyLevel, Priority>> = {
  HIGH: { HIGH: 'P1', MEDIUM: 'P2', LOW: 'P3' },
  MEDIUM: { HIGH: 'P2', MEDIUM: 'P3', LOW: 'P4' },
  LOW: { HIGH: 'P3', MEDIUM: 'P4', LOW: 'P4' },
};

export function computePriority(impact: ImpactLevel, urgency: UrgencyLevel): Priority {
  return PRIORITY_MATRIX[impact][urgency];
}
