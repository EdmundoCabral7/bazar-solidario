import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middlewares/auth';
import { slaState } from '../tickets/sla';

export const dashboardRoutes = Router();
dashboardRoutes.use(requireAuth);

/** Indicadores do painel administrativo (mês corrente, fuso de Fortaleza). */
dashboardRoutes.get('/', async (_req, res) => {
  const now = new Date();
  const local = new Date(now.getTime() - 3 * 3600_000);
  const monthStart = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1, 3));

  const [
    sales,
    donations,
    sponsorshipPayments,
    activeSponsors,
    ordersByStatus,
    adoptionsOpen,
    openTickets,
    outboxPending,
    outboxFailed,
  ] = await Promise.all([
    prisma.payment.aggregate({
      where: { status: 'APPROVED', orderId: { not: null }, paidAt: { gte: monthStart } },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: { status: 'APPROVED', donationId: { not: null }, paidAt: { gte: monthStart } },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: { status: 'APPROVED', sponsorshipId: { not: null }, paidAt: { gte: monthStart } },
      _sum: { amountCents: true },
    }),
    prisma.sponsorship.count({ where: { status: 'ACTIVE' } }),
    prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.adoptionRequest.groupBy({
      by: ['status'],
      where: { status: { in: ['RECEIVED', 'IN_REVIEW', 'INTERVIEW'] } },
      _count: { _all: true },
    }),
    prisma.ticket.findMany({
      where: { status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_USER'] }, type: { not: 'PROBLEM' } },
      select: {
        priority: true,
        createdAt: true,
        responseDueAt: true,
        resolutionDueAt: true,
        firstResponseAt: true,
        resolvedAt: true,
      },
    }),
    prisma.notificationOutbox.count({ where: { status: 'PENDING' } }),
    prisma.notificationOutbox.count({ where: { status: 'FAILED' } }),
  ]);

  const ticketsByPriority = { P1: 0, P2: 0, P3: 0, P4: 0 };
  const ticketsBySla = { ON_TRACK: 0, AT_RISK: 0, VIOLATED: 0, MET: 0 };
  for (const t of openTickets) {
    ticketsByPriority[t.priority]++;
    ticketsBySla[slaState(t, now)]++;
  }

  res.json({
    month: { from: monthStart },
    sales: { count: sales._count, totalCents: sales._sum.amountCents ?? 0 },
    donations: { count: donations._count, totalCents: donations._sum.amountCents ?? 0 },
    sponsorships: { active: activeSponsors, monthCents: sponsorshipPayments._sum.amountCents ?? 0 },
    orders: Object.fromEntries(ordersByStatus.map((o) => [o.status, o._count._all])),
    adoptionsInProgress: Object.fromEntries(adoptionsOpen.map((a) => [a.status, a._count._all])),
    tickets: { open: openTickets.length, byPriority: ticketsByPriority, bySla: ticketsBySla },
    notifications: { pending: outboxPending, failed: outboxFailed },
  });
});
