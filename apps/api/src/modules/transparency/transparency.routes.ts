import { Router } from 'express';
import { z } from 'zod';
import {
  expenseInputSchema,
  ExpenseCategories,
  paginationSchema,
  transparencyQuerySchema,
} from '@bazar/shared';
import { AppError } from '../../lib/errors';
import { pageArgs, toPage } from '../../lib/pagination';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireRole } from '../../middlewares/auth';
import { transparencyReport } from './transparency.service';

export const transparencyRoutes = Router();

transparencyRoutes.get('/', async (req, res) => {
  const { months } = transparencyQuerySchema.parse(req.query);
  res.json(await transparencyReport(months));
});

/** Despesas (somente admin — tesouraria). */
export const adminExpenseRoutes = Router();
adminExpenseRoutes.use(requireAuth, requireRole('ADMIN'));

const filters = paginationSchema.extend({ category: z.enum(ExpenseCategories).optional() });

adminExpenseRoutes.get('/', async (req, res) => {
  const f = filters.parse(req.query);
  const where = { category: f.category };
  const [data, total] = await Promise.all([
    prisma.expense.findMany({ where, orderBy: { spentAt: 'desc' }, ...pageArgs(f) }),
    prisma.expense.count({ where }),
  ]);
  res.json(toPage(data, total, f));
});
adminExpenseRoutes.post('/', async (req, res) => {
  res.status(201).json(await prisma.expense.create({ data: expenseInputSchema.parse(req.body) }));
});
adminExpenseRoutes.patch('/:id', async (req, res) => {
  const data = expenseInputSchema.partial().parse(req.body);
  if (!(await prisma.expense.findUnique({ where: { id: req.params.id } })))
    throw AppError.notFound('Despesa não encontrada');
  res.json(await prisma.expense.update({ where: { id: req.params.id }, data }));
});
adminExpenseRoutes.delete('/:id', async (req, res) => {
  if (!(await prisma.expense.findUnique({ where: { id: req.params.id } })))
    throw AppError.notFound('Despesa não encontrada');
  await prisma.expense.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
