import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';

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
