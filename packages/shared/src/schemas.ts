import { z } from 'zod';
import {
  AdoptionStatuses,
  AnimalSizes,
  AnimalStatuses,
  ExpenseCategories,
  ImpactLevels,
  ItServiceCodes,
  OrderStatuses,
  ProductConditions,
  ProductStatuses,
  Roles,
  Sexes,
  Species,
  SponsorshipPlans,
  SupportLevels,
  TicketStatuses,
  TicketTypes,
  UrgencyLevels,
} from './enums';

// ---------- Primitivos ----------

export const cepSchema = z
  .string()
  .trim()
  .regex(/^\d{5}-?\d{3}$/, 'CEP inválido')
  .transform((v) => v.replace('-', ''));

/** Telefone BR com DDD (10 ou 11 dígitos), aceitando máscara. Normaliza para só dígitos. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, ''))
  .refine((v) => /^\d{10,11}$/.test(v), 'Telefone inválido (informe DDD + número)');

const consentSchema = z.literal(true, {
  errorMap: () => ({ message: 'É necessário aceitar o uso dos dados (LGPD)' }),
});
const name = z.string().trim().min(2, 'Informe o nome').max(120);
const email = z.string().trim().toLowerCase().email('Informe um e-mail válido');
const cents = z.number().int('Valor em centavos deve ser inteiro');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------- Auth / usuários ----------

export const loginSchema = z.object({
  email: z.string().email('Informe um e-mail válido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const createUserSchema = z.object({
  name,
  email,
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres'),
  role: z.enum(Roles),
});
export const updateUserSchema = z.object({
  name: name.optional(),
  role: z.enum(Roles).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

// ---------- Catálogo ----------

export const animalFiltersSchema = paginationSchema.extend({
  species: z.enum(Species).optional(),
  size: z.enum(AnimalSizes).optional(),
  sex: z.enum(Sexes).optional(),
  status: z.enum(AnimalStatuses).optional(),
});

export const animalInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  species: z.enum(Species),
  ageMonths: z.number().int().min(0).max(360),
  size: z.enum(AnimalSizes),
  sex: z.enum(Sexes),
  neutered: z.boolean().default(false),
  vaccinated: z.boolean().default(false),
  description: z.string().trim().min(10).max(2000),
  photos: z.array(z.string().url()).max(10).default([]),
  status: z.enum(AnimalStatuses).default('AVAILABLE'),
});
export type AnimalInput = z.infer<typeof animalInputSchema>;

export const productFiltersSchema = paginationSchema.extend({
  category: z.string().optional(),
  size: z.string().optional(),
  condition: z.enum(ProductConditions).optional(),
  q: z.string().trim().max(80).optional(),
  maxPriceCents: z.coerce.number().int().positive().optional(),
});

export const productInputSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().min(5).max(2000),
  category: z.string().trim().min(2).max(40),
  size: z.string().trim().max(20).nullish(),
  condition: z.enum(ProductConditions),
  priceCents: cents.min(100, 'Preço mínimo de R$ 1,00'),
  photos: z.array(z.string().url()).max(10).default([]),
  stock: z.number().int().min(0).default(1),
  weightGrams: z.number().int().min(50).max(30000).default(500),
  status: z.enum(ProductStatuses).default('ACTIVE'),
});
export type ProductInput = z.infer<typeof productInputSchema>;

export const campaignInputSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(2000),
  goalCents: cents.positive(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().nullish(),
  active: z.boolean().default(true),
});

// ---------- Frete ----------

const cartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
});

export const shippingQuoteSchema = z.object({
  cep: cepSchema,
  items: z.array(cartItemSchema).min(1, 'Carrinho vazio'),
});
export type ShippingQuoteInput = z.infer<typeof shippingQuoteSchema>;

// ---------- Pagamento ----------

/** Dados de pagamento. Para cartão, `cardToken` vem do SDK JS do Mercado Pago (ou um token mock). */
export const paymentInputSchema = z.discriminatedUnion('method', [
  z.object({ method: z.literal('PIX') }),
  z.object({
    method: z.literal('CARD'),
    cardToken: z.string().min(1, 'Token do cartão é obrigatório'),
    paymentMethodId: z.string().min(1).default('visa'),
    installments: z.number().int().min(1).max(12).default(1),
  }),
]);
export type PaymentInput = z.infer<typeof paymentInputSchema>;

// ---------- Pedidos ----------

export const createOrderSchema = z
  .object({
    customer: z.object({ name, email, phone: phoneSchema }),
    items: z.array(cartItemSchema).min(1, 'Carrinho vazio').max(30),
    delivery: z.discriminatedUnion('type', [
      z.object({ type: z.literal('PICKUP') }),
      z.object({
        type: z.literal('SHIPPING'),
        cep: cepSchema,
        street: z.string().trim().min(2),
        number: z.string().trim().min(1).max(10),
        complement: z.string().trim().max(60).optional(),
        district: z.string().trim().min(2),
        city: z.string().trim().min(2),
        state: z.string().trim().length(2).toUpperCase(),
        shippingService: z.string().min(1, 'Escolha uma opção de frete'),
      }),
    ]),
    payment: paymentInputSchema,
    consent: consentSchema,
  })
  .refine((o) => new Set(o.items.map((i) => i.productId)).size === o.items.length, {
    message: 'Produto repetido no carrinho',
    path: ['items'],
  });
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const updateOrderStatusSchema = z.object({
  status: z.enum(OrderStatuses),
  trackingCode: z.string().trim().max(40).optional(),
});

export const orderFiltersSchema = paginationSchema.extend({
  status: z.enum(OrderStatuses).optional(),
});

// ---------- Doações e apadrinhamento ----------

export const createDonationSchema = z
  .object({
    amountCents: cents.min(500, 'Doação mínima de R$ 5,00').max(10_000_00),
    anonymous: z.boolean().default(false),
    donorName: name.optional(),
    donorEmail: email.optional(),
    campaignSlug: z.string().optional(),
    payment: paymentInputSchema,
    consent: z.boolean().default(false),
  })
  .refine((d) => !d.donorEmail || d.consent, {
    message: 'É necessário aceitar o uso dos dados (LGPD) para informar e-mail',
    path: ['consent'],
  })
  .refine((d) => d.payment.method !== 'CARD' || !!d.donorEmail, {
    message: 'Informe o e-mail para pagar com cartão',
    path: ['donorEmail'],
  });
export type CreateDonationInput = z.infer<typeof createDonationSchema>;

export const createSponsorshipSchema = z.object({
  animalSlug: z.string().min(1),
  plan: z.enum(SponsorshipPlans),
  sponsorName: name,
  sponsorEmail: email,
  consent: consentSchema,
});
export type CreateSponsorshipInput = z.infer<typeof createSponsorshipSchema>;

export const cancelSponsorshipSchema = z.object({ email });

// ---------- Adoção ----------

export const adoptionAnswersSchema = z.object({
  housingType: z.enum(['HOUSE', 'APARTMENT', 'OTHER']),
  ownsHome: z.boolean(),
  hasYard: z.boolean(),
  hasOtherPets: z.boolean(),
  otherPetsDescription: z.string().max(300).optional(),
  hasChildren: z.boolean(),
  hoursAlonePerDay: z.number().int().min(0).max(24),
  allResidentsAgree: z.literal(true, {
    errorMap: () => ({ message: 'Todos os moradores precisam concordar com a adoção' }),
  }),
  canAffordCosts: z.boolean(),
  motivation: z.string().trim().min(20, 'Conte um pouco mais (mín. 20 caracteres)').max(1000),
});

export const createAdoptionSchema = z.object({
  animalSlug: z.string().min(1),
  applicantName: name,
  applicantEmail: email,
  applicantPhone: phoneSchema,
  city: z.string().trim().min(2).max(80),
  answers: adoptionAnswersSchema,
  consent: consentSchema,
});
export type CreateAdoptionInput = z.infer<typeof createAdoptionSchema>;

export const updateAdoptionStatusSchema = z.object({
  status: z.enum(AdoptionStatuses),
  notes: z.string().max(2000).optional(),
});

// ---------- Transparência ----------

export const expenseInputSchema = z.object({
  category: z.enum(ExpenseCategories),
  description: z.string().trim().min(3).max(200),
  amountCents: cents.positive(),
  spentAt: z.coerce.date(),
});

export const transparencyQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(6),
});

// ---------- Parceiros ----------

export const createPartnerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  contactEmail: email,
});

// ---------- Central de serviços (ITIL) ----------

export const createTicketSchema = z.object({
  serviceCode: z.enum(ItServiceCodes),
  type: z.enum(['INCIDENT', 'SERVICE_REQUEST']),
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(10).max(4000),
  requesterName: name,
  requesterEmail: email,
  impact: z.enum(ImpactLevels),
  urgency: z.enum(UrgencyLevels),
});
export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const createInternalTicketSchema = createTicketSchema.extend({
  type: z.enum(TicketTypes),
});

export const ticketFiltersSchema = paginationSchema.extend({
  status: z.enum(TicketStatuses).optional(),
  priority: z.enum(['P1', 'P2', 'P3', 'P4']).optional(),
  level: z.enum(SupportLevels).optional(),
  serviceCode: z.enum(ItServiceCodes).optional(),
  type: z.enum(TicketTypes).optional(),
});

export const updateTicketStatusSchema = z.object({
  status: z.enum(TicketStatuses),
  message: z.string().trim().max(2000).optional(),
});
export const escalateTicketSchema = z.object({
  toLevel: z.enum(SupportLevels),
  reason: z.string().trim().min(5, 'Informe o motivo do escalonamento').max(1000),
});
export const assignTicketSchema = z.object({ assigneeId: z.string().min(1).nullable() });
export const commentTicketSchema = z.object({ message: z.string().trim().min(1).max(2000) });
export const linkProblemSchema = z.object({ problemId: z.string().min(1).nullable() });
export const requesterReplySchema = z.object({
  email,
  message: z.string().trim().min(1).max(2000),
});

export const slaReportQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});
