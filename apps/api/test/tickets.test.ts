import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { calculateSlaDeadlines } from '../src/modules/tickets/sla';
import { adminToken, resetDb, seedItServices } from './helpers';

const app = createApp();
let token: string;

const ticketBody = {
  serviceCode: 'S01',
  type: 'INCIDENT',
  title: 'Checkout não abre',
  description: 'Ao clicar em finalizar compra a página fica em branco.',
  requesterName: 'Carla',
  requesterEmail: 'carla@test.dev',
  impact: 'HIGH',
  urgency: 'MEDIUM',
};

beforeEach(async () => {
  await resetDb();
  await seedItServices();
  token = (await adminToken()).token;
});
afterAll(() => prisma.$disconnect());

const auth = () => ({ authorization: `Bearer ${token}` });

describe('central de serviços', () => {
  it('abertura pública calcula prioridade pela matriz e prazos de SLA', async () => {
    const res = await request(app).post('/api/tickets').send(ticketBody);
    expect(res.status).toBe(201);
    expect(res.body.protocol).toMatch(/^CH-\d{4}-[A-Z0-9]{6}$/);
    expect(res.body.priority).toBe('P2');
    const t = await prisma.ticket.findUniqueOrThrow({ where: { protocol: res.body.protocol } });
    expect(t.responseDueAt).toEqual(calculateSlaDeadlines(t.createdAt, 'P2').responseDueAt);
    expect(await prisma.notificationOutbox.count({ where: { template: 'TICKET_CREATED' } })).toBe(
      1,
    );
  });

  it('acompanhamento por protocolo não expõe e-mail', async () => {
    const { protocol } = (await request(app).post('/api/tickets').send(ticketBody)).body;
    const res = await request(app).get(`/api/tickets/protocol/${protocol}`);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('carla@test.dev');
  });

  it('fluxo: atender → aguardar usuário → resposta do usuário → resolver → encerrar', async () => {
    const { protocol } = (await request(app).post('/api/tickets').send(ticketBody)).body;
    const { id } = await prisma.ticket.findUniqueOrThrow({ where: { protocol } });

    const r1 = await request(app)
      .patch(`/api/tickets/${id}/status`)
      .set(auth())
      .send({ status: 'WAITING_USER', message: 'Qual navegador?' });
    expect(r1.body.firstResponseAt).not.toBeNull();

    const reply = await request(app)
      .post(`/api/tickets/protocol/${protocol}/reply`)
      .send({ email: 'carla@test.dev', message: 'Chrome' });
    expect(reply.body.status).toBe('IN_PROGRESS');

    await request(app).patch(`/api/tickets/${id}/status`).set(auth()).send({ status: 'RESOLVED' });
    const closed = await request(app)
      .patch(`/api/tickets/${id}/status`)
      .set(auth())
      .send({ status: 'CLOSED' });
    expect(closed.body.status).toBe('CLOSED');
    expect(closed.body.slaState).toBe('MET');

    const invalid = await request(app)
      .patch(`/api/tickets/${id}/status`)
      .set(auth())
      .send({ status: 'IN_PROGRESS' });
    expect(invalid.status).toBe(409);
  });

  it('escalonamento N1 → N2 → N3 registra eventos; não volta de nível', async () => {
    const { protocol } = (await request(app).post('/api/tickets').send(ticketBody)).body;
    const { id } = await prisma.ticket.findUniqueOrThrow({ where: { protocol } });
    await request(app)
      .post(`/api/tickets/${id}/escalate`)
      .set(auth())
      .send({ toLevel: 'N2', reason: 'Precisa de acesso ao servidor' });
    const n3 = await request(app)
      .post(`/api/tickets/${id}/escalate`)
      .set(auth())
      .send({ toLevel: 'N3', reason: 'Bug no código do checkout' });
    expect(n3.body.level).toBe('N3');
    expect(n3.body.events.filter((e: { type: string }) => e.type === 'ESCALATED')).toHaveLength(2);
    const back = await request(app)
      .post(`/api/tickets/${id}/escalate`)
      .set(auth())
      .send({ toLevel: 'N1', reason: 'teste de volta' });
    expect(back.status).toBe(409);
  });

  it('gerenciamento de problemas: vincula incidentes a um problema', async () => {
    const problem = await request(app)
      .post('/api/tickets/internal')
      .set(auth())
      .send({ ...ticketBody, type: 'PROBLEM', title: 'Checkout instável' });
    const inc = (await request(app).post('/api/tickets').send(ticketBody)).body;
    const { id } = await prisma.ticket.findUniqueOrThrow({ where: { protocol: inc.protocol } });
    const linked = await request(app)
      .post(`/api/tickets/${id}/problem`)
      .set(auth())
      .send({ problemId: problem.body.id });
    expect(linked.body.problem.id).toBe(problem.body.id);
    const p = await request(app).get(`/api/tickets/${problem.body.id}`).set(auth());
    expect(p.body.incidents).toHaveLength(1);
  });

  it('fila exige login e ordena por prioridade', async () => {
    expect((await request(app).get('/api/tickets')).status).toBe(401);
    await request(app)
      .post('/api/tickets')
      .send({ ...ticketBody, impact: 'LOW', urgency: 'LOW' });
    await request(app)
      .post('/api/tickets')
      .send({ ...ticketBody, impact: 'HIGH', urgency: 'HIGH' });
    const res = await request(app).get('/api/tickets').set(auth());
    expect(res.body.data.map((t: { priority: string }) => t.priority)).toEqual(['P1', 'P4']);
    expect(res.body.data[0].slaState).toBe('ON_TRACK');
  });
});

describe('relatório de SLA', () => {
  it('calcula conformidade, médias e violações', async () => {
    const service = await prisma.itService.findUniqueOrThrow({ where: { code: 'S02' } });
    const base = new Date('2026-11-10T12:00:00Z');
    const mk = (protocol: string, resp: number, resol: number | null) =>
      prisma.ticket.create({
        data: {
          protocol,
          serviceId: service.id,
          type: 'INCIDENT',
          title: protocol,
          description: 'x',
          requesterName: 'x',
          requesterEmail: 'x@test.dev',
          impact: 'HIGH',
          urgency: 'HIGH',
          priority: 'P1',
          createdAt: base,
          responseDueAt: new Date(base.getTime() + 30 * 60_000),
          resolutionDueAt: new Date(base.getTime() + 4 * 3600_000),
          firstResponseAt: new Date(base.getTime() + resp * 60_000),
          resolvedAt: resol === null ? null : new Date(base.getTime() + resol * 60_000),
          status: resol === null ? 'IN_PROGRESS' : 'RESOLVED',
        },
      });
    await mk('A', 10, 60); // tudo no prazo
    await mk('B', 45, 120); // resposta atrasada
    await mk('C', 20, 300); // resolução atrasada
    await mk('D', 15, null); // aberto e já estourou a resolução (agora > base + 4h)

    const res = await request(app)
      .get('/api/tickets/sla-report')
      .query({ from: '2026-11-01', to: '2026-11-30' })
      .set(auth());
    expect(res.status).toBe(200);
    const { overall, byPriority, violations } = res.body;
    expect(overall.total).toBe(4);
    expect(overall.response).toMatchObject({
      met: 3,
      violated: 1,
      compliancePct: 75,
      avgMinutes: 23,
    });
    expect(overall.resolution).toMatchObject({
      met: 2,
      violated: 2,
      compliancePct: 50,
      avgMinutes: 160,
    });
    expect(byPriority.P1.total).toBe(4);
    expect(violations.map((v: { protocol: string }) => v.protocol).sort()).toEqual(['B', 'C', 'D']);
  });
});
