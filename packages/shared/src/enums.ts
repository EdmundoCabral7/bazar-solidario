/** Enums de domínio compartilhados entre API e Web (espelham o schema Prisma). */
export const Roles = ['ADMIN', 'VOLUNTEER', 'SUPPORT_N2'] as const;
export type Role = (typeof Roles)[number];

export const Species = ['DOG', 'CAT'] as const;
export const AnimalStatuses = ['AVAILABLE', 'IN_ADOPTION', 'ADOPTED'] as const;
export const ProductStatuses = ['ACTIVE', 'SOLD', 'HIDDEN'] as const;
export const OrderStatuses = [
  'PENDING_PAYMENT',
  'PAID',
  'SHIPPED',
  'DELIVERED',
  'CANCELED',
] as const;
export const DeliveryTypes = ['PICKUP', 'SHIPPING'] as const;
export const SponsorshipPlans = ['P20', 'P50', 'P100'] as const;
export type SponsorshipPlan = (typeof SponsorshipPlans)[number];
export const SPONSORSHIP_PLAN_CENTS: Record<SponsorshipPlan, number> = {
  P20: 2000,
  P50: 5000,
  P100: 10000,
};
export const PaymentMethods = ['PIX', 'CARD'] as const;
export const AdoptionStatuses = [
  'RECEIVED',
  'IN_REVIEW',
  'INTERVIEW',
  'APPROVED',
  'REJECTED',
] as const;
export const ExpenseCategories = [
  'RACAO',
  'VETERINARIO',
  'CASTRACAO',
  'MANUTENCAO',
  'OUTROS',
] as const;
export const TicketTypes = ['INCIDENT', 'SERVICE_REQUEST', 'PROBLEM'] as const;
export const ImpactLevels = ['LOW', 'MEDIUM', 'HIGH'] as const;
export const UrgencyLevels = ['LOW', 'MEDIUM', 'HIGH'] as const;
export const Priorities = ['P1', 'P2', 'P3', 'P4'] as const;
export const SupportLevels = ['N1', 'N2', 'N3'] as const;
export const TicketStatuses = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_USER',
  'RESOLVED',
  'CLOSED',
] as const;
