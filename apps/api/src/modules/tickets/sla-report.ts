import type { Priority } from '@bazar/shared';
import { prisma } from '../../lib/prisma';

interface Bucket {
  total: number;
  responseMet: number;
  responseViolated: number;
  responsePending: number;
  resolutionMet: number;
  resolutionViolated: number;
  resolutionPending: number;
  responseMinutesSum: number;
  responseCount: number;
  resolutionMinutesSum: number;
  resolutionCount: number;
}

const emptyBucket = (): Bucket => ({
  total: 0,
  responseMet: 0,
  responseViolated: 0,
  responsePending: 0,
  resolutionMet: 0,
  resolutionViolated: 0,
  resolutionPending: 0,
  responseMinutesSum: 0,
  responseCount: 0,
  resolutionMinutesSum: 0,
  resolutionCount: 0,
});

const pct = (met: number, violated: number) =>
  met + violated === 0 ? null : Math.round((met / (met + violated)) * 1000) / 10;
const avg = (sum: number, n: number) => (n === 0 ? null : Math.round(sum / n));

function finalize(b: Bucket) {
  return {
    total: b.total,
    response: {
      met: b.responseMet,
      violated: b.responseViolated,
      pending: b.responsePending,
      compliancePct: pct(b.responseMet, b.responseViolated),
      avgMinutes: avg(b.responseMinutesSum, b.responseCount),
    },
    resolution: {
      met: b.resolutionMet,
      violated: b.resolutionViolated,
      pending: b.resolutionPending,
      compliancePct: pct(b.resolutionMet, b.resolutionViolated),
      avgMinutes: avg(b.resolutionMinutesSum, b.resolutionCount),
    },
  };
}

/**
 * Relatório de SLA dos chamados abertos no período [from, to].
 * Conformidade = cumpridos / (cumpridos + violados); chamados ainda dentro do prazo ficam "pendentes".
 * Tempos médios em minutos de relógio. Problemas (PROBLEM) não entram no SLA.
 */
export async function slaReport(from: Date, to: Date, now = new Date()) {
  const tickets = await prisma.ticket.findMany({
    where: { createdAt: { gte: from, lte: to }, type: { in: ['INCIDENT', 'SERVICE_REQUEST'] } },
    include: { service: { select: { code: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const overall = emptyBucket();
  const byPriority: Record<Priority, Bucket> = {
    P1: emptyBucket(),
    P2: emptyBucket(),
    P3: emptyBucket(),
    P4: emptyBucket(),
  };
  const byService = new Map<
    string,
    { code: string; name: string; total: number; violated: number }
  >();
  const violations: {
    protocol: string;
    title: string;
    priority: Priority;
    service: string;
    status: string;
    violated: ('RESPONSE' | 'RESOLUTION')[];
    createdAt: Date;
  }[] = [];

  for (const t of tickets) {
    const buckets = [overall, byPriority[t.priority]];
    const responseViolated = t.firstResponseAt
      ? t.firstResponseAt > t.responseDueAt
      : now > t.responseDueAt;
    const responsePending = !t.firstResponseAt && !responseViolated;
    const resolutionViolated = t.resolvedAt
      ? t.resolvedAt > t.resolutionDueAt
      : now > t.resolutionDueAt;
    const resolutionPending = !t.resolvedAt && !resolutionViolated;

    for (const b of buckets) {
      b.total++;
      if (responsePending) b.responsePending++;
      else if (responseViolated) b.responseViolated++;
      else b.responseMet++;
      if (resolutionPending) b.resolutionPending++;
      else if (resolutionViolated) b.resolutionViolated++;
      else b.resolutionMet++;
      if (t.firstResponseAt) {
        b.responseMinutesSum += (t.firstResponseAt.getTime() - t.createdAt.getTime()) / 60_000;
        b.responseCount++;
      }
      if (t.resolvedAt) {
        b.resolutionMinutesSum += (t.resolvedAt.getTime() - t.createdAt.getTime()) / 60_000;
        b.resolutionCount++;
      }
    }

    const svc = byService.get(t.service.code) ?? { ...t.service, total: 0, violated: 0 };
    svc.total++;
    if (responseViolated || resolutionViolated) {
      svc.violated++;
      violations.push({
        protocol: t.protocol,
        title: t.title,
        priority: t.priority,
        service: t.service.code,
        status: t.status,
        violated: [
          ...(responseViolated ? ['RESPONSE' as const] : []),
          ...(resolutionViolated ? ['RESOLUTION' as const] : []),
        ],
        createdAt: t.createdAt,
      });
    }
    byService.set(t.service.code, svc);
  }

  return {
    period: { from, to },
    generatedAt: now,
    overall: finalize(overall),
    byPriority: Object.fromEntries(Object.entries(byPriority).map(([k, b]) => [k, finalize(b)])),
    byService: [...byService.values()].sort((a, b) => a.code.localeCompare(b.code)),
    violations,
  };
}
