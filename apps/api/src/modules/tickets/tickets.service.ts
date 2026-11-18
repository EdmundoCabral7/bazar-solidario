import type { Prisma, Ticket, TicketStatus } from '@prisma/client';
import {
  computePriority,
  type CreateTicketInput,
  type ImpactLevel,
  type UrgencyLevel,
} from '@bazar/shared';
import { publicCode } from '../../lib/codes';
import { AppError } from '../../lib/errors';
import { pageArgs, toPage } from '../../lib/pagination';
import { prisma } from '../../lib/prisma';
import { enqueueNotification } from '../notifications/outbox';
import { calculateSlaDeadlines, formatDeadline, slaState } from './sla';

type Tx = Prisma.TransactionClient;

const SYSTEM_REQUESTER = { name: 'Monitoramento automático', email: 'ti@pataspotiguares.org' };

/** Transições de status permitidas (CLOSED é final; reabrir = RESOLVED → IN_PROGRESS). */
const TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ['IN_PROGRESS', 'WAITING_USER', 'RESOLVED'],
  IN_PROGRESS: ['WAITING_USER', 'RESOLVED'],
  WAITING_USER: ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: [],
};

const LEVEL_ORDER = { N1: 1, N2: 2, N3: 3 } as const;

interface CreateOptions {
  type?: 'INCIDENT' | 'SERVICE_REQUEST' | 'PROBLEM';
  authorId?: string;
  notify?: boolean;
  /** Para simulação: data de abertura retroativa. */
  openedAt?: Date;
}

type TicketInput = Omit<CreateTicketInput, 'type'> & { type?: CreateOptions['type'] };

async function createInTx(tx: Tx, input: TicketInput, opts: CreateOptions) {
  const service = await tx.itService.findUnique({ where: { code: input.serviceCode } });
  if (!service) throw AppError.badRequest('Serviço inexistente no catálogo');
  const priority = computePriority(input.impact, input.urgency);
  const openedAt = opts.openedAt ?? new Date();
  const deadlines = calculateSlaDeadlines(openedAt, priority);
  const ticket = await tx.ticket.create({
    data: {
      protocol: publicCode('CH', true),
      serviceId: service.id,
      type: input.type ?? 'INCIDENT',
      title: input.title,
      description: input.description,
      requesterName: input.requesterName,
      requesterEmail: input.requesterEmail,
      impact: input.impact,
      urgency: input.urgency,
      priority,
      ...deadlines,
      createdAt: openedAt,
      events: {
        create: {
          type: 'CREATED',
          toValue: priority,
          message: `Chamado aberto (impacto ${input.impact}, urgência ${input.urgency} → ${priority})`,
          authorId: opts.authorId,
          createdAt: openedAt,
        },
      },
    },
    include: { service: true },
  });
  if (opts.notify !== false) {
    await enqueueNotification(tx, { email: ticket.requesterEmail }, 'TICKET_CREATED', {
      protocol: ticket.protocol,
      title: ticket.title,
      priority,
      responseDue: formatDeadline(ticket.responseDueAt),
    });
  }
  return ticket;
}

export async function createTicket(input: TicketInput, opts: CreateOptions = {}) {
  const ticket = await prisma.$transaction((tx) =>
    createInTx(tx, { ...input, type: input.type ?? 'INCIDENT' }, opts),
  );
  return presentTicket(ticket);
}

/** Abre incidente automático (ex.: inconsistência de pagamento) dentro de uma transação existente. */
export async function openSystemTicket(
  tx: Tx,
  input: {
    serviceCode: CreateTicketInput['serviceCode'];
    title: string;
    description: string;
    impact: ImpactLevel;
    urgency: UrgencyLevel;
  },
) {
  return createInTx(
    tx,
    {
      ...input,
      type: 'INCIDENT',
      requesterName: SYSTEM_REQUESTER.name,
      requesterEmail: SYSTEM_REQUESTER.email,
    },
    { notify: false },
  );
}

type TicketWithService = Ticket & { service: { code: string; name: string } };

export function presentTicket(t: TicketWithService, now = new Date()) {
  return {
    id: t.id,
    protocol: t.protocol,
    service: { code: t.service.code, name: t.service.name },
    type: t.type,
    title: t.title,
    description: t.description,
    requesterName: t.requesterName,
    requesterEmail: t.requesterEmail,
    impact: t.impact,
    urgency: t.urgency,
    priority: t.priority,
    level: t.level,
    status: t.status,
    assigneeId: t.assigneeId,
    problemId: t.problemId,
    responseDueAt: t.responseDueAt,
    resolutionDueAt: t.resolutionDueAt,
    firstResponseAt: t.firstResponseAt,
    resolvedAt: t.resolvedAt,
    closedAt: t.closedAt,
    createdAt: t.createdAt,
    slaState: slaState(t, now),
  };
}

/** Consulta pública por protocolo (sem e-mail do solicitante, sem notas internas). */
export async function getPublicTicket(protocol: string) {
  const t = await prisma.ticket.findUnique({
    where: { protocol: protocol.toUpperCase() },
    include: {
      service: true,
      events: {
        where: { type: { in: ['CREATED', 'STATUS_CHANGED', 'COMMENT'] } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!t) throw AppError.notFound('Chamado não encontrado. Confira o protocolo.');
  return {
    protocol: t.protocol,
    service: { code: t.service.code, name: t.service.name },
    type: t.type,
    title: t.title,
    priority: t.priority,
    status: t.status,
    createdAt: t.createdAt,
    responseDueAt: t.responseDueAt,
    resolutionDueAt: t.resolutionDueAt,
    resolvedAt: t.resolvedAt,
    events: t.events.map((e) => ({
      type: e.type,
      toValue: e.toValue,
      message: e.message,
      createdAt: e.createdAt,
    })),
  };
}

/** Solicitante responde (ex.: chamado em WAITING_USER volta para IN_PROGRESS). */
export async function requesterReply(protocol: string, email: string, message: string) {
  const t = await prisma.ticket.findUnique({ where: { protocol: protocol.toUpperCase() } });
  if (!t || t.requesterEmail.toLowerCase() !== email.toLowerCase()) {
    throw AppError.notFound('Chamado não encontrado para este e-mail');
  }
  if (t.status === 'CLOSED') throw AppError.conflict('Chamado encerrado. Abra um novo chamado.');
  await prisma.$transaction(async (tx) => {
    await tx.ticketEvent.create({
      data: { ticketId: t.id, type: 'COMMENT', message: `[Solicitante] ${message}` },
    });
    if (t.status === 'WAITING_USER') {
      await tx.ticket.update({ where: { id: t.id }, data: { status: 'IN_PROGRESS' } });
      await tx.ticketEvent.create({
        data: {
          ticketId: t.id,
          type: 'STATUS_CHANGED',
          fromValue: 'WAITING_USER',
          toValue: 'IN_PROGRESS',
          message: 'Resposta do solicitante',
        },
      });
    }
  });
  return getPublicTicket(protocol);
}

export async function listTickets(f: {
  page: number;
  pageSize: number;
  scope?: 'active' | 'all';
  status?: TicketStatus;
  priority?: Ticket['priority'];
  level?: Ticket['level'];
  serviceCode?: string;
  type?: Ticket['type'];
}) {
  const where: Prisma.TicketWhereInput = {
    status:
      f.status ??
      (f.scope === 'active' ? { in: ['OPEN', 'IN_PROGRESS', 'WAITING_USER'] } : undefined),
    priority: f.priority,
    level: f.level,
    type: f.type,
    ...(f.serviceCode ? { service: { code: f.serviceCode } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: { service: true },
      // fila: prioridade e depois prazo de resolução mais próximo
      orderBy: [{ priority: 'asc' }, { resolutionDueAt: 'asc' }],
      ...pageArgs(f),
    }),
    prisma.ticket.count({ where }),
  ]);
  const now = new Date();
  return toPage(
    rows.map((t) => presentTicket(t, now)),
    total,
    f,
  );
}

export async function getTicket(id: string) {
  const t = await prisma.ticket.findUnique({
    where: { id },
    include: {
      service: true,
      assignee: { select: { id: true, name: true } },
      problem: { select: { id: true, protocol: true, title: true } },
      incidents: { select: { id: true, protocol: true, title: true, status: true } },
      events: {
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { id: true, name: true } } },
      },
    },
  });
  if (!t) throw AppError.notFound('Chamado não encontrado');
  return {
    ...presentTicket(t),
    assignee: t.assignee,
    problem: t.problem,
    incidents: t.incidents,
    events: t.events,
  };
}

async function findOrThrow(tx: Tx, id: string) {
  const t = await tx.ticket.findUnique({ where: { id } });
  if (!t) throw AppError.notFound('Chamado não encontrado');
  return t;
}

export async function updateTicketStatus(
  id: string,
  status: TicketStatus,
  authorId: string,
  message?: string,
) {
  await prisma.$transaction(async (tx) => {
    const t = await findOrThrow(tx, id);
    if (!TRANSITIONS[t.status].includes(status)) {
      throw new AppError(
        409,
        'INVALID_TRANSITION',
        `Não é possível mudar de ${t.status} para ${status}`,
      );
    }
    const now = new Date();
    await tx.ticket.update({
      where: { id },
      data: {
        status,
        firstResponseAt: t.firstResponseAt ?? now,
        resolvedAt: status === 'RESOLVED' ? now : status === 'IN_PROGRESS' ? null : t.resolvedAt,
        closedAt: status === 'CLOSED' ? now : null,
      },
    });
    await tx.ticketEvent.create({
      data: {
        ticketId: id,
        type: 'STATUS_CHANGED',
        fromValue: t.status,
        toValue: status,
        message,
        authorId,
      },
    });
    await enqueueNotification(tx, { email: t.requesterEmail }, 'TICKET_UPDATED', {
      protocol: t.protocol,
      status,
      message,
    });
  });
  return getTicket(id);
}

export async function escalateTicket(
  id: string,
  toLevel: Ticket['level'],
  reason: string,
  authorId: string,
) {
  await prisma.$transaction(async (tx) => {
    const t = await findOrThrow(tx, id);
    if (t.status === 'CLOSED' || t.status === 'RESOLVED')
      throw AppError.conflict('Chamado já resolvido');
    if (LEVEL_ORDER[toLevel] <= LEVEL_ORDER[t.level]) {
      throw new AppError(409, 'INVALID_ESCALATION', `O chamado já está no nível ${t.level}`);
    }
    await tx.ticket.update({ where: { id }, data: { level: toLevel, assigneeId: null } });
    await tx.ticketEvent.create({
      data: {
        ticketId: id,
        type: 'ESCALATED',
        fromValue: t.level,
        toValue: toLevel,
        message: reason,
        authorId,
      },
    });
  });
  return getTicket(id);
}

export async function assignTicket(id: string, assigneeId: string | null, authorId: string) {
  await prisma.$transaction(async (tx) => {
    await findOrThrow(tx, id);
    if (assigneeId) {
      const user = await tx.user.findUnique({ where: { id: assigneeId } });
      if (!user?.active) throw AppError.badRequest('Responsável inexistente ou inativo');
    }
    await tx.ticket.update({ where: { id }, data: { assigneeId } });
    await tx.ticketEvent.create({
      data: { ticketId: id, type: 'ASSIGNED', toValue: assigneeId, authorId },
    });
  });
  return getTicket(id);
}

export async function commentTicket(id: string, message: string, authorId: string) {
  await prisma.$transaction(async (tx) => {
    const t = await findOrThrow(tx, id);
    await tx.ticketEvent.create({ data: { ticketId: id, type: 'COMMENT', message, authorId } });
    if (!t.firstResponseAt)
      await tx.ticket.update({ where: { id }, data: { firstResponseAt: new Date() } });
    await enqueueNotification(tx, { email: t.requesterEmail }, 'TICKET_UPDATED', {
      protocol: t.protocol,
      status: t.status,
      message,
    });
  });
  return getTicket(id);
}

/** Gerenciamento de problemas: vincula um incidente a um chamado do tipo PROBLEM (ou desvincula). */
export async function linkProblem(id: string, problemId: string | null, authorId: string) {
  await prisma.$transaction(async (tx) => {
    const t = await findOrThrow(tx, id);
    if (t.type !== 'INCIDENT')
      throw AppError.badRequest('Somente incidentes podem ser vinculados a um problema');
    if (problemId) {
      const problem = await tx.ticket.findUnique({ where: { id: problemId } });
      if (problem?.type !== 'PROBLEM')
        throw AppError.badRequest('O chamado de destino não é um problema');
    }
    await tx.ticket.update({ where: { id }, data: { problemId } });
    await tx.ticketEvent.create({
      data: { ticketId: id, type: 'LINKED_PROBLEM', toValue: problemId, authorId },
    });
  });
  return getTicket(id);
}
