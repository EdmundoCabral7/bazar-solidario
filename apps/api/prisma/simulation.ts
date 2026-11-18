/**
 * Seed de simulação da Central de Serviços (npm run seed:simulation).
 *
 * Gera ~40 chamados fictícios distribuídos nas últimas 2 semanas, com mix de serviços,
 * prioridades, escalonamentos, um problema com incidentes vinculados e ~20% de violações de SLA.
 * Os prazos usam a MESMA função calculateSlaDeadlines do sistema. Ao final imprime o relatório de SLA.
 * Pode ser executado várias vezes: remove a simulação anterior antes de recriar.
 */
import { PrismaClient, type Priority, type SupportLevel } from '@prisma/client';
import { computePriority, type ImpactLevel, type UrgencyLevel } from '@bazar/shared';
import { calculateSlaDeadlines } from '../src/modules/tickets/sla';
import { slaReport } from '../src/modules/tickets/sla-report';

const prisma = new PrismaClient();
const SIM_DOMAIN = '@simulacao.pataspotiguares.org';
const TOTAL = 40;
const DAYS = 14;

// PRNG determinístico (mulberry32) — a simulação gera sempre os mesmos dados
let seed = 20261119;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;
const between = (a: number, b: number) => a + rand() * (b - a);

const SCENARIOS: {
  service: string;
  type: 'INCIDENT' | 'SERVICE_REQUEST';
  title: string;
  impact: ImpactLevel;
  urgency: UrgencyLevel;
}[] = [
  {
    service: 'S01',
    type: 'INCIDENT',
    title: 'Checkout do bazar fora do ar',
    impact: 'HIGH',
    urgency: 'HIGH',
  },
  {
    service: 'S01',
    type: 'INCIDENT',
    title: 'QR Code Pix não aparece no pedido',
    impact: 'HIGH',
    urgency: 'MEDIUM',
  },
  {
    service: 'S01',
    type: 'INCIDENT',
    title: 'Foto da peça não carrega no celular',
    impact: 'LOW',
    urgency: 'MEDIUM',
  },
  {
    service: 'S01',
    type: 'SERVICE_REQUEST',
    title: 'Cadastrar nova categoria de peças',
    impact: 'LOW',
    urgency: 'LOW',
  },
  {
    service: 'S02',
    type: 'INCIDENT',
    title: 'Doação paga não confirmada',
    impact: 'HIGH',
    urgency: 'HIGH',
  },
  {
    service: 'S02',
    type: 'INCIDENT',
    title: 'Padrinho cobrado duas vezes no mês',
    impact: 'MEDIUM',
    urgency: 'HIGH',
  },
  {
    service: 'S02',
    type: 'SERVICE_REQUEST',
    title: 'Alterar plano de apadrinhamento',
    impact: 'LOW',
    urgency: 'MEDIUM',
  },
  {
    service: 'S03',
    type: 'INCIDENT',
    title: 'Formulário de adoção não envia',
    impact: 'MEDIUM',
    urgency: 'HIGH',
  },
  {
    service: 'S03',
    type: 'SERVICE_REQUEST',
    title: 'Dúvida sobre o andamento da adoção',
    impact: 'LOW',
    urgency: 'LOW',
  },
  {
    service: 'S04',
    type: 'INCIDENT',
    title: 'Gráfico de despesas do mês zerado',
    impact: 'MEDIUM',
    urgency: 'MEDIUM',
  },
  {
    service: 'S05',
    type: 'INCIDENT',
    title: 'Painel admin lento para listar pedidos',
    impact: 'MEDIUM',
    urgency: 'LOW',
  },
  {
    service: 'S06',
    type: 'SERVICE_REQUEST',
    title: 'Criar acesso para nova voluntária',
    impact: 'LOW',
    urgency: 'MEDIUM',
  },
  {
    service: 'S06',
    type: 'SERVICE_REQUEST',
    title: 'Revogar acesso de voluntário desligado',
    impact: 'MEDIUM',
    urgency: 'MEDIUM',
  },
  {
    service: 'S07',
    type: 'SERVICE_REQUEST',
    title: 'Restaurar despesa apagada por engano',
    impact: 'MEDIUM',
    urgency: 'LOW',
  },
  {
    service: 'S08',
    type: 'SERVICE_REQUEST',
    title: 'Como acompanhar meu chamado?',
    impact: 'LOW',
    urgency: 'LOW',
  },
];

const NAMES = [
  'Ana',
  'Bruno',
  'Carla',
  'Diego',
  'Elisa',
  'Fábio',
  'Gabriela',
  'Heitor',
  'Íris',
  'João',
  'Larissa',
  'Marcos',
];
const MIN = 60_000;

/** Instante de abertura: maioria em horário comercial, alguns à noite e no fim de semana. */
function openedAt(now: Date): Date {
  const d = new Date(now.getTime() - between(0.3, DAYS) * 86400_000);
  const local = new Date(d.getTime() - 3 * 3600_000);
  const hour = rand() < 0.8 ? Math.floor(between(8, 18)) : pick([6, 7, 19, 21, 23]);
  local.setUTCHours(hour, Math.floor(between(0, 60)), 0, 0);
  return new Date(local.getTime() + 3 * 3600_000);
}

async function main() {
  const now = new Date();
  const removed = await prisma.ticket.deleteMany({
    where: { requesterEmail: { endsWith: SIM_DOMAIN } },
  });
  if (removed.count) console.log(`Simulação anterior removida (${removed.count} chamados).`);

  const services = Object.fromEntries(
    (await prisma.itService.findMany()).map((s) => [s.code, s.id]),
  );
  if (Object.keys(services).length < 8)
    throw new Error('Rode `npm run db:seed` antes (catálogo S01–S08).');
  const users = await prisma.user.findMany({ where: { active: true } });
  const n1 = users.filter((u) => u.role === 'VOLUNTEER');
  const n2 = users.filter((u) => u.role !== 'VOLUNTEER');

  let protoSeq = 1;
  const protocol = () => `CH-SIM-${String(protoSeq++).padStart(4, '0')}`;

  // Problema recorrente com incidentes vinculados (gerenciamento de problemas)
  const problemOpened = new Date(now.getTime() - 9 * 86400_000);
  const problemDeadlines = calculateSlaDeadlines(problemOpened, 'P2');
  const problem = await prisma.ticket.create({
    data: {
      protocol: protocol(),
      serviceId: services.S01!,
      type: 'PROBLEM',
      title: 'Falhas intermitentes na geração do Pix',
      description:
        'Causa-raiz: timeout no gateway sem retentativa. Ação: circuit breaker + retry com backoff.',
      requesterName: 'Responsável de TI',
      requesterEmail: `ti${SIM_DOMAIN}`,
      impact: 'HIGH',
      urgency: 'MEDIUM',
      priority: 'P2',
      level: 'N3',
      status: 'RESOLVED',
      ...problemDeadlines,
      firstResponseAt: new Date(problemOpened.getTime() + 40 * MIN),
      resolvedAt: new Date(problemOpened.getTime() + 2 * 86400_000),
      createdAt: problemOpened,
      events: {
        create: [
          {
            type: 'CREATED',
            message: 'Problema registrado após 4 incidentes semelhantes',
            createdAt: problemOpened,
          },
        ],
      },
    },
  });

  let violatedTarget = 0;
  for (let i = 0; i < TOTAL; i++) {
    const scenario = i < 4 ? SCENARIOS[1]! : pick(SCENARIOS); // 4 primeiros = incidentes do problema
    const priority: Priority = computePriority(scenario.impact, scenario.urgency);
    const created =
      i < 4
        ? new Date(problemOpened.getTime() - (4 - i) * 86400_000 + between(0, 8) * 3600_000)
        : openedAt(now);
    const { responseDueAt, resolutionDueAt } = calculateSlaDeadlines(created, priority);

    // ~20% dos chamados violam algum prazo
    const violate = rand() < 0.2;
    if (violate) violatedTarget++;
    const responseLate = violate && rand() < 0.5;
    const responseWindow = responseDueAt.getTime() - created.getTime();
    const resolutionWindow = resolutionDueAt.getTime() - created.getTime();

    let firstResponseAt: Date | null = responseLate
      ? new Date(responseDueAt.getTime() + between(10, 180) * MIN)
      : new Date(created.getTime() + responseWindow * between(0.1, 0.85));
    let resolvedAt: Date | null =
      violate && !responseLate
        ? new Date(resolutionDueAt.getTime() + between(30, 600) * MIN)
        : new Date(created.getTime() + resolutionWindow * between(0.3, 0.95));
    if (resolvedAt <= firstResponseAt) resolvedAt = new Date(firstResponseAt.getTime() + 20 * MIN);
    if (firstResponseAt > now) firstResponseAt = null;
    if (!firstResponseAt || resolvedAt > now) resolvedAt = null;

    const closed = resolvedAt && now.getTime() - resolvedAt.getTime() > 2 * 86400_000;
    const status = closed
      ? 'CLOSED'
      : resolvedAt
        ? 'RESOLVED'
        : firstResponseAt
          ? pick(['IN_PROGRESS', 'IN_PROGRESS', 'WAITING_USER'] as const)
          : 'OPEN';
    const level: SupportLevel =
      priority === 'P1' || (priority === 'P2' && rand() < 0.6)
        ? rand() < 0.3
          ? 'N3'
          : 'N2'
        : 'N1';
    const assignee = firstResponseAt ? (pick(level === 'N1' ? n1 : n2) ?? null) : null;
    const name = pick(NAMES);

    const events: {
      type: 'CREATED' | 'STATUS_CHANGED' | 'ESCALATED';
      fromValue?: string;
      toValue?: string;
      message?: string;
      createdAt: Date;
      authorId?: string;
    }[] = [
      {
        type: 'CREATED',
        toValue: priority,
        message: `Chamado aberto (impacto ${scenario.impact}, urgência ${scenario.urgency} → ${priority})`,
        createdAt: created,
      },
    ];
    if (firstResponseAt) {
      events.push({
        type: 'STATUS_CHANGED',
        fromValue: 'OPEN',
        toValue: 'IN_PROGRESS',
        createdAt: firstResponseAt,
        authorId: assignee?.id,
      });
      if (level !== 'N1') {
        events.push({
          type: 'ESCALATED',
          fromValue: 'N1',
          toValue: 'N2',
          message: 'Requer acesso técnico',
          createdAt: new Date(firstResponseAt.getTime() + 5 * MIN),
          authorId: assignee?.id,
        });
        if (level === 'N3')
          events.push({
            type: 'ESCALATED',
            fromValue: 'N2',
            toValue: 'N3',
            message: 'Correção no código necessária',
            createdAt: new Date(firstResponseAt.getTime() + 30 * MIN),
            authorId: assignee?.id,
          });
      }
    }
    if (resolvedAt)
      events.push({
        type: 'STATUS_CHANGED',
        fromValue: 'IN_PROGRESS',
        toValue: 'RESOLVED',
        createdAt: resolvedAt,
        authorId: assignee?.id,
      });
    if (closed)
      events.push({
        type: 'STATUS_CHANGED',
        fromValue: 'RESOLVED',
        toValue: 'CLOSED',
        createdAt: new Date(resolvedAt!.getTime() + 2 * 86400_000),
      });

    await prisma.ticket.create({
      data: {
        protocol: protocol(),
        serviceId: services[scenario.service]!,
        type: scenario.type,
        title: scenario.title,
        description: `Chamado simulado para a evidência de operação do catálogo de serviços (${scenario.service}).`,
        requesterName: `${name} (simulação)`,
        requesterEmail: `${name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}${SIM_DOMAIN}`,
        impact: scenario.impact,
        urgency: scenario.urgency,
        priority,
        level,
        status,
        responseDueAt,
        resolutionDueAt,
        firstResponseAt,
        resolvedAt,
        closedAt: closed ? new Date(resolvedAt!.getTime() + 2 * 86400_000) : null,
        assigneeId: assignee?.id,
        problemId: i < 4 ? problem.id : null,
        createdAt: created,
        events: { create: events },
      },
    });
  }

  const from = new Date(now.getTime() - (DAYS + 5) * 86400_000);
  const report = await slaReport(from, now, now);
  console.log(
    `\n${TOTAL} chamados simulados + 1 problema (com 4 incidentes vinculados). Alvo de violação: ${violatedTarget}.`,
  );
  console.log('\nRelatório de SLA (últimas 2 semanas):');
  console.table(
    Object.fromEntries(
      Object.entries(report.byPriority).map(([p, b]) => [
        p,
        {
          total: b.total,
          'resposta no prazo %': b.response.compliancePct,
          'resolução no prazo %': b.resolution.compliancePct,
          'tempo médio resposta (min)': b.response.avgMinutes,
          'tempo médio resolução (min)': b.resolution.avgMinutes,
        },
      ]),
    ),
  );
  console.log(
    `Geral: resposta ${report.overall.response.compliancePct}% | resolução ${report.overall.resolution.compliancePct}% | ${report.violations.length} chamados com violação`,
  );
  console.log(
    `\nVeja também: GET /api/tickets/sla-report?from=${from.toISOString().slice(0, 10)}&to=${now.toISOString().slice(0, 10)}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
