import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { createUserSchema, updateUserSchema } from '@bazar/shared';
import { AppError } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireRole } from '../../middlewares/auth';

const select = { id: true, name: true, email: true, role: true, active: true, createdAt: true };

/** S06 — Gestão de acessos (somente ADMIN). */
export const adminUserRoutes = Router();
adminUserRoutes.use(requireAuth);

/** Lista resumida para atribuição de chamados (qualquer usuário interno). */
adminUserRoutes.get('/assignable', async (_req, res) => {
  res.json(
    await prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    }),
  );
});

adminUserRoutes.use(requireRole('ADMIN'));

adminUserRoutes.get('/', async (_req, res) => {
  res.json(await prisma.user.findMany({ select, orderBy: { name: 'asc' } }));
});

adminUserRoutes.post('/', async (req, res) => {
  const { password, ...input } = createUserSchema.parse(req.body);
  if (await prisma.user.findUnique({ where: { email: input.email } }))
    throw AppError.conflict('E-mail já cadastrado');
  const user = await prisma.user.create({
    data: { ...input, passwordHash: await bcrypt.hash(password, 10) },
    select,
  });
  res.status(201).json(user);
});

adminUserRoutes.patch('/:id', async (req, res) => {
  const { password, ...input } = updateUserSchema.parse(req.body);
  if (
    req.params.id === req.user!.id &&
    (input.active === false || (input.role && input.role !== 'ADMIN'))
  ) {
    throw AppError.badRequest('Você não pode desativar nem rebaixar o próprio acesso');
  }
  if (!(await prisma.user.findUnique({ where: { id: req.params.id } })))
    throw AppError.notFound('Usuário não encontrado');
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { ...input, ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) },
    select,
  });
  res.json(user);
});
