import { Router } from 'express';
import { z } from 'zod';
import { paginationSchema, SponsorshipStatuses } from '@bazar/shared';
import { pageArgs, toPage } from '../../lib/pagination';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireRole } from '../../middlewares/auth';
import { cancelSponsorship } from '../sponsorships/sponsorships.service';

/** Consulta de doações e apadrinhamentos (tesouraria / admin). */
export const adminFundraisingRoutes = Router();
adminFundraisingRoutes.use(requireAuth, requireRole('ADMIN'));

adminFundraisingRoutes.get('/donations', async (req, res) => {
  const f = paginationSchema.parse(req.query);
  const [data, total] = await Promise.all([
    prisma.donation.findMany({
      include: {
        payment: { select: { status: true, method: true, paidAt: true } },
        campaign: { select: { slug: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      ...pageArgs(f),
    }),
    prisma.donation.count(),
  ]);
  res.json(toPage(data, total, f));
});

const sponsorshipFilters = paginationSchema.extend({
  status: z.enum(SponsorshipStatuses).optional(),
});

adminFundraisingRoutes.get('/sponsorships', async (req, res) => {
  const f = sponsorshipFilters.parse(req.query);
  const where = { status: f.status };
  const [data, total] = await Promise.all([
    prisma.sponsorship.findMany({
      where,
      include: {
        animal: { select: { slug: true, name: true } },
        _count: { select: { payments: { where: { status: 'APPROVED' } } } },
      },
      orderBy: { createdAt: 'desc' },
      ...pageArgs(f),
    }),
    prisma.sponsorship.count({ where }),
  ]);
  res.json(toPage(data, total, f));
});

adminFundraisingRoutes.post('/sponsorships/:id/cancel', async (req, res) => {
  res.json(await cancelSponsorship(req.params.id, { byAdmin: true }));
});
