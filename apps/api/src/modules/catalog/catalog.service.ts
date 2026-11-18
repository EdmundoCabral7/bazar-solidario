import type { Prisma } from '@prisma/client';
import type { AnimalInput, campaignInputSchema, ProductInput } from '@bazar/shared';
import type { z } from 'zod';
import { uniqueSlug } from '../../lib/codes';
import { AppError } from '../../lib/errors';
import { pageArgs, toPage } from '../../lib/pagination';
import { prisma } from '../../lib/prisma';

// ---------- Animais ----------

export interface AnimalFilters {
  page: number;
  pageSize: number;
  species?: 'DOG' | 'CAT';
  size?: 'SMALL' | 'MEDIUM' | 'LARGE';
  sex?: 'MALE' | 'FEMALE';
  status?: 'AVAILABLE' | 'IN_ADOPTION' | 'ADOPTED';
}

/** Lista pública: por padrão só animais disponíveis ou em processo de adoção. */
export async function listAnimals(f: AnimalFilters, opts: { admin?: boolean } = {}) {
  const where: Prisma.AnimalWhereInput = {
    species: f.species,
    size: f.size,
    sex: f.sex,
    status: f.status ?? (opts.admin ? undefined : { in: ['AVAILABLE', 'IN_ADOPTION'] }),
  };
  const [data, total] = await Promise.all([
    prisma.animal.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      ...pageArgs(f),
      include: { _count: { select: { sponsorships: { where: { status: 'ACTIVE' } } } } },
    }),
    prisma.animal.count({ where }),
  ]);
  return toPage(
    data.map(({ _count, ...a }) => ({ ...a, activeSponsors: _count.sponsorships })),
    total,
    f,
  );
}

export async function getAnimalBySlug(slug: string) {
  const a = await prisma.animal.findUnique({
    where: { slug },
    include: { _count: { select: { sponsorships: { where: { status: 'ACTIVE' } } } } },
  });
  if (!a) throw AppError.notFound('Animal não encontrado');
  const { _count, ...animal } = a;
  return { ...animal, activeSponsors: _count.sponsorships };
}

export async function createAnimal(input: AnimalInput) {
  const slug = await uniqueSlug(
    input.name,
    async (s) => !!(await prisma.animal.findUnique({ where: { slug: s } })),
  );
  return prisma.animal.create({ data: { ...input, slug } });
}

export async function updateAnimal(id: string, input: Partial<AnimalInput>) {
  await ensure(prisma.animal.findUnique({ where: { id } }), 'Animal não encontrado');
  return prisma.animal.update({ where: { id }, data: input });
}

export async function deleteAnimal(id: string) {
  await ensure(prisma.animal.findUnique({ where: { id } }), 'Animal não encontrado');
  const links =
    (await prisma.adoptionRequest.count({ where: { animalId: id } })) +
    (await prisma.sponsorship.count({ where: { animalId: id } }));
  if (links > 0)
    throw AppError.conflict(
      'Animal possui adoções ou apadrinhamentos; altere o status em vez de excluir',
    );
  await prisma.animal.delete({ where: { id } });
}

// ---------- Peças do bazar ----------

export interface ProductFilters {
  page: number;
  pageSize: number;
  category?: string;
  size?: string;
  condition?: 'NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR';
  q?: string;
  maxPriceCents?: number;
}

export async function listProducts(f: ProductFilters, opts: { admin?: boolean } = {}) {
  const where: Prisma.ProductWhereInput = {
    ...(opts.admin ? {} : { status: 'ACTIVE', stock: { gt: 0 } }),
    category: f.category ? { equals: f.category, mode: 'insensitive' } : undefined,
    size: f.size ? { equals: f.size, mode: 'insensitive' } : undefined,
    condition: f.condition,
    priceCents: f.maxPriceCents ? { lte: f.maxPriceCents } : undefined,
    ...(f.q
      ? {
          OR: [
            { title: { contains: f.q, mode: 'insensitive' } },
            { description: { contains: f.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [data, total] = await Promise.all([
    prisma.product.findMany({ where, orderBy: { createdAt: 'desc' }, ...pageArgs(f) }),
    prisma.product.count({ where }),
  ]);
  return toPage(data, total, f);
}

export async function listCategories() {
  const rows = await prisma.product.groupBy({
    by: ['category'],
    where: { status: 'ACTIVE', stock: { gt: 0 } },
    _count: { _all: true },
    orderBy: { category: 'asc' },
  });
  return rows.map((r) => ({ category: r.category, count: r._count._all }));
}

export async function getProductBySlug(slug: string, opts: { admin?: boolean } = {}) {
  const p = await prisma.product.findUnique({ where: { slug } });
  if (!p || (!opts.admin && p.status === 'HIDDEN')) throw AppError.notFound('Peça não encontrada');
  return p;
}

export async function createProduct(input: ProductInput) {
  const slug = await uniqueSlug(
    `${input.title} ${input.size ?? ''}`,
    async (s) => !!(await prisma.product.findUnique({ where: { slug: s } })),
  );
  return prisma.product.create({ data: { ...input, slug } });
}

export async function updateProduct(id: string, input: Partial<ProductInput>) {
  await ensure(prisma.product.findUnique({ where: { id } }), 'Peça não encontrada');
  return prisma.product.update({ where: { id }, data: input });
}

/** Peças com pedidos são ocultadas (HIDDEN) em vez de excluídas, para preservar o histórico. */
export async function deleteProduct(id: string) {
  await ensure(prisma.product.findUnique({ where: { id } }), 'Peça não encontrada');
  if (await prisma.orderItem.count({ where: { productId: id } })) {
    await prisma.product.update({ where: { id }, data: { status: 'HIDDEN' } });
    return { hidden: true };
  }
  await prisma.product.delete({ where: { id } });
  return { hidden: false };
}

// ---------- Campanhas ----------

async function raisedByCampaign(ids: string[]) {
  if (ids.length === 0) return new Map<string, number>();
  const rows = await prisma.payment.findMany({
    where: { status: 'APPROVED', donation: { campaignId: { in: ids } } },
    select: { amountCents: true, donation: { select: { campaignId: true } } },
  });
  const map = new Map<string, number>();
  for (const r of rows) {
    const id = r.donation!.campaignId!;
    map.set(id, (map.get(id) ?? 0) + r.amountCents);
  }
  return map;
}

export async function listCampaigns(opts: { activeOnly: boolean }) {
  const now = new Date();
  const campaigns = await prisma.campaign.findMany({
    where: opts.activeOnly
      ? { active: true, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gte: now } }] }
      : {},
    orderBy: { startsAt: 'desc' },
  });
  const raised = await raisedByCampaign(campaigns.map((c) => c.id));
  return campaigns.map((c) => {
    const raisedCents = raised.get(c.id) ?? 0;
    return {
      ...c,
      raisedCents,
      progressPct: Math.min(100, Math.round((raisedCents / c.goalCents) * 100)),
    };
  });
}

export async function getCampaign(slug: string) {
  const c = await prisma.campaign.findUnique({ where: { slug } });
  if (!c) throw AppError.notFound('Campanha não encontrada');
  const raisedCents = (await raisedByCampaign([c.id])).get(c.id) ?? 0;
  return {
    ...c,
    raisedCents,
    progressPct: Math.min(100, Math.round((raisedCents / c.goalCents) * 100)),
  };
}

export async function createCampaign(input: z.infer<typeof campaignInputSchema>) {
  const slug = await uniqueSlug(
    input.title,
    async (s) => !!(await prisma.campaign.findUnique({ where: { slug: s } })),
  );
  return prisma.campaign.create({ data: { ...input, slug } });
}

export async function updateCampaign(id: string, input: Prisma.CampaignUpdateInput) {
  await ensure(prisma.campaign.findUnique({ where: { id } }), 'Campanha não encontrada');
  return prisma.campaign.update({ where: { id }, data: input });
}

async function ensure<T>(p: Promise<T | null>, message: string): Promise<T> {
  const v = await p;
  if (!v) throw AppError.notFound(message);
  return v;
}
