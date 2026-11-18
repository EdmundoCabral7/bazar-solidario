import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';
import { signToken } from '../src/middlewares/auth';

/** Limpa todas as tabelas do banco de teste (exceto o histórico de migrations). */
export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(
    `TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`,
  );
}

export async function createUser(
  overrides: {
    email?: string;
    password?: string;
    role?: 'ADMIN' | 'VOLUNTEER' | 'SUPPORT_N2';
    active?: boolean;
  } = {},
) {
  const email =
    overrides.email ?? `user-${Date.now()}-${Math.random().toString(36).slice(2)}@test.dev`;
  return prisma.user.create({
    data: {
      name: 'Usuário Teste',
      email,
      passwordHash: await bcrypt.hash(overrides.password ?? 'senha123', 4),
      role: overrides.role ?? 'VOLUNTEER',
      active: overrides.active ?? true,
    },
  });
}

export async function adminToken() {
  const user = await createUser({ role: 'ADMIN' });
  return { user, token: signToken({ id: user.id, email: user.email, role: 'ADMIN' }) };
}

export async function seedItServices() {
  const codes = ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08'];
  await prisma.itService.createMany({
    data: codes.map((code) => ({
      code,
      name: `Serviço ${code}`,
      owner: 'TI',
      description: 'teste',
    })),
  });
}

export async function createProduct(
  overrides: { stock?: number; priceCents?: number; slug?: string } = {},
) {
  return prisma.product.create({
    data: {
      slug: overrides.slug ?? `peca-${Math.random().toString(36).slice(2, 8)}`,
      title: 'Camisa teste',
      description: 'Peça de teste',
      category: 'Roupas',
      condition: 'GOOD',
      priceCents: overrides.priceCents ?? 2500,
      stock: overrides.stock ?? 2,
    },
  });
}

export async function createAnimal(
  overrides: { slug?: string; status?: 'AVAILABLE' | 'IN_ADOPTION' | 'ADOPTED' } = {},
) {
  return prisma.animal.create({
    data: {
      slug: overrides.slug ?? `animal-${Math.random().toString(36).slice(2, 8)}`,
      name: 'Rex',
      species: 'DOG',
      ageMonths: 12,
      size: 'MEDIUM',
      sex: 'MALE',
      description: 'Cachorro de teste muito dócil',
      status: overrides.status ?? 'AVAILABLE',
    },
  });
}

export const orderBody = (
  productId: string,
  payment: object = { method: 'PIX' },
  quantity = 1,
) => ({
  customer: { name: 'Maria Teste', email: 'maria@test.dev', phone: '(84) 99999-1234' },
  items: [{ productId, quantity }],
  delivery: { type: 'PICKUP' },
  payment,
  consent: true,
});
