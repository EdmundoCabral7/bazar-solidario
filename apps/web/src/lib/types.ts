/** Tipos das respostas da API consumidas pelo portal. */
export interface Page<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Animal {
  id: string;
  slug: string;
  name: string;
  species: 'DOG' | 'CAT';
  ageMonths: number;
  size: 'SMALL' | 'MEDIUM' | 'LARGE';
  sex: 'MALE' | 'FEMALE';
  neutered: boolean;
  vaccinated: boolean;
  description: string;
  photos: string[];
  status: 'AVAILABLE' | 'IN_ADOPTION' | 'ADOPTED';
  activeSponsors?: number;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  size: string | null;
  condition: 'NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR';
  priceCents: number;
  photos: string[];
  stock: number;
  weightGrams: number;
  status: 'ACTIVE' | 'SOLD' | 'HIDDEN';
}

export interface Campaign {
  id: string;
  slug: string;
  title: string;
  description: string;
  goalCents: number;
  raisedCents: number;
  progressPct: number;
  startsAt: string;
  endsAt: string | null;
  active: boolean;
}

export interface Payment {
  id: string;
  method: 'PIX' | 'CARD';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFUNDED' | 'CANCELED';
  amountCents: number;
  pixCopyPaste: string | null;
  pixQrCodeBase64: string | null;
  expiresAt: string | null;
  paidAt: string | null;
}

export type OrderStatus = 'PENDING_PAYMENT' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELED';

export interface Order {
  id: string;
  code: string;
  status: OrderStatus;
  customer: { name: string; email: string; phone?: string };
  delivery: {
    type: 'PICKUP' | 'SHIPPING';
    cep?: string;
    street?: string;
    number?: string;
    complement?: string | null;
    district?: string;
    city?: string;
    state?: string;
    trackingCode: string | null;
  };
  items: {
    productId: string;
    slug: string;
    title: string;
    photo: string | null;
    quantity: number;
    unitPriceCents: number;
  }[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  payment: Payment | null;
  createdAt: string;
}

export interface Donation {
  id: string;
  amountCents: number;
  anonymous: boolean;
  campaign: { slug: string; title: string } | null;
  payment: Payment | null;
  createdAt: string;
}

export interface Sponsorship {
  id: string;
  status: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'CANCELED';
  plan: 'P20' | 'P50' | 'P100';
  amountCents: number;
  animal: { slug: string; name: string; photo: string | null };
  checkoutUrl: string | null;
  createdAt: string;
  canceledAt: string | null;
}

export interface ShippingOption {
  service: string;
  company: string;
  priceCents: number;
  deliveryDays: number;
}

export interface Address {
  cep: string;
  street: string;
  district: string;
  city: string;
  state: string;
}

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_USER' | 'RESOLVED' | 'CLOSED';
export type Priority = 'P1' | 'P2' | 'P3' | 'P4';
export type SlaState = 'ON_TRACK' | 'AT_RISK' | 'VIOLATED' | 'MET';

export interface ItServicesResponse {
  services: {
    id: string;
    code: string;
    name: string;
    owner: string;
    description: string;
    availabilityTarget: number | null;
    rpoHours: number | null;
    rtoHours: number | null;
  }[];
  sla: Record<
    Priority,
    { responseMinutes: number; resolutionMinutes: number; continuous: boolean }
  >;
  businessHours: { days: string; start: string; end: string; timezone: string };
}

export interface TicketEvent {
  id?: string;
  type: 'CREATED' | 'STATUS_CHANGED' | 'ESCALATED' | 'ASSIGNED' | 'COMMENT' | 'LINKED_PROBLEM';
  fromValue?: string | null;
  toValue: string | null;
  message: string | null;
  createdAt: string;
  author?: { id: string; name: string } | null;
}

export interface PublicTicket {
  protocol: string;
  service: { code: string; name: string };
  type: string;
  title: string;
  priority: Priority;
  status: TicketStatus;
  createdAt: string;
  responseDueAt: string;
  resolutionDueAt: string;
  resolvedAt: string | null;
  events: TicketEvent[];
}

export interface Ticket {
  id: string;
  protocol: string;
  service: { code: string; name: string };
  type: 'INCIDENT' | 'SERVICE_REQUEST' | 'PROBLEM';
  title: string;
  description: string;
  requesterName: string;
  requesterEmail: string;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  priority: Priority;
  level: 'N1' | 'N2' | 'N3';
  status: TicketStatus;
  assigneeId: string | null;
  problemId: string | null;
  responseDueAt: string;
  resolutionDueAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  slaState: SlaState;
}

export interface TicketDetail extends Ticket {
  assignee: { id: string; name: string } | null;
  problem: { id: string; protocol: string; title: string } | null;
  incidents: { id: string; protocol: string; title: string; status: TicketStatus }[];
  events: TicketEvent[];
}

export interface Transparency {
  period: { from: string; months: number };
  totals: { raisedCents: number; spentCents: number; balanceCents: number };
  spentByCategory: Record<string, number>;
  months: {
    month: string;
    raisedCents: { sales: number; donations: number; sponsorships: number; total: number };
    spentCents: { byCategory: Record<string, number>; total: number };
    balanceCents: number;
  }[];
  impact: { activeSponsorships: number; adoptedAnimals: number; availableAnimals: number };
}

export interface Health {
  status: 'ok' | 'degraded';
  database: { status: 'up' | 'down' };
  integrations: {
    name: string;
    mode: 'mock' | 'sandbox' | 'real';
    status: string;
    circuit?: string;
  }[];
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'VOLUNTEER' | 'SUPPORT_N2';
}
