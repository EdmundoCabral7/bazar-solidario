import { Router } from 'express';
import {
  assignTicketSchema,
  commentTicketSchema,
  createInternalTicketSchema,
  createTicketSchema,
  escalateTicketSchema,
  linkProblemSchema,
  requesterReplySchema,
  slaReportQuerySchema,
  ticketFiltersSchema,
  updateTicketStatusSchema,
} from '@bazar/shared';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middlewares/auth';
import { formLimiter } from '../../middlewares/rate-limit';
import { slaReport } from './sla-report';
import { SLA_TARGETS } from './sla';
import * as service from './tickets.service';

/** Rotas públicas: catálogo de serviços, abertura e acompanhamento por protocolo. */
export const publicTicketRoutes = Router();

publicTicketRoutes.get('/it-services', async (_req, res) => {
  const services = await prisma.itService.findMany({ orderBy: { code: 'asc' } });
  res.json({
    services: services.map((s) => ({
      ...s,
      availabilityTarget: s.availabilityTarget ? Number(s.availabilityTarget) : null,
    })),
    sla: SLA_TARGETS,
    businessHours: { days: 'seg–sex', start: '08:00', end: '18:00', timezone: 'America/Fortaleza' },
  });
});

publicTicketRoutes.post('/tickets', formLimiter, async (req, res) => {
  const input = createTicketSchema.parse(req.body);
  const ticket = await service.createTicket(input);
  res.status(201).json({
    protocol: ticket.protocol,
    priority: ticket.priority,
    status: ticket.status,
    responseDueAt: ticket.responseDueAt,
    resolutionDueAt: ticket.resolutionDueAt,
  });
});

publicTicketRoutes.get('/tickets/protocol/:protocol', async (req, res) => {
  res.json(await service.getPublicTicket(req.params.protocol));
});

publicTicketRoutes.post('/tickets/protocol/:protocol/reply', formLimiter, async (req, res) => {
  const { email, message } = requesterReplySchema.parse(req.body);
  res.json(await service.requesterReply(String(req.params.protocol), email, message));
});

/** Rotas internas (qualquer usuário autenticado: N1 voluntário, N2 TI, admin). */
export const adminTicketRoutes = Router();
adminTicketRoutes.use(requireAuth);

adminTicketRoutes.get('/sla-report', async (req, res) => {
  const { from, to } = slaReportQuerySchema.parse(req.query);
  res.json(await slaReport(from, to));
});

adminTicketRoutes.get('/', async (req, res) => {
  res.json(await service.listTickets(ticketFiltersSchema.parse(req.query)));
});

adminTicketRoutes.post('/internal', async (req, res) => {
  const input = createInternalTicketSchema.parse(req.body);
  res.status(201).json(await service.createTicket(input, { authorId: req.user!.id }));
});

adminTicketRoutes.get('/:id', async (req, res) => {
  res.json(await service.getTicket(req.params.id));
});

adminTicketRoutes.patch('/:id/status', async (req, res) => {
  const { status, message } = updateTicketStatusSchema.parse(req.body);
  res.json(await service.updateTicketStatus(req.params.id, status, req.user!.id, message));
});

adminTicketRoutes.post('/:id/escalate', async (req, res) => {
  const { toLevel, reason } = escalateTicketSchema.parse(req.body);
  res.json(await service.escalateTicket(req.params.id, toLevel, reason, req.user!.id));
});

adminTicketRoutes.post('/:id/assign', async (req, res) => {
  const { assigneeId } = assignTicketSchema.parse(req.body);
  res.json(await service.assignTicket(req.params.id, assigneeId, req.user!.id));
});

adminTicketRoutes.post('/:id/comments', async (req, res) => {
  const { message } = commentTicketSchema.parse(req.body);
  res.json(await service.commentTicket(req.params.id, message, req.user!.id));
});

adminTicketRoutes.post('/:id/problem', async (req, res) => {
  const { problemId } = linkProblemSchema.parse(req.body);
  res.json(await service.linkProblem(req.params.id, problemId, req.user!.id));
});
