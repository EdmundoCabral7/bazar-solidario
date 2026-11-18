/**
 * Cálculo de prazos de SLA (funções puras, sem I/O).
 *
 * Regras (Manual de Governança, §SLA):
 * | Prioridade | 1ª resposta          | Resolução           |
 * | P1         | 30 min (corridos)    | 4 h (corridas)      |
 * | P2         | 2 h úteis            | 8 h úteis           |
 * | P3         | 4 h úteis            | 2 dias úteis (20 h) |
 * | P4         | 1 dia útil (10 h)    | 3 dias úteis (30 h) |
 *
 * Horário útil: seg–sex, 08h–18h, fuso America/Fortaleza (UTC−3 fixo, sem horário de verão),
 * excluindo feriados nacionais, do RN e de Natal. "1 dia útil" = 10 h úteis.
 */
import type { Priority } from '@bazar/shared';

export interface BusinessCalendar {
  /** Deslocamento do fuso em minutos (America/Fortaleza = −180). */
  utcOffsetMinutes: number;
  startHour: number;
  endHour: number;
  /** Datas locais 'YYYY-MM-DD' sem expediente. */
  holidays: ReadonlySet<string>;
}

/** Feriados 2026–2027: nacionais + RN (03/10) + Natal (06/01, 21/11). */
export const HOLIDAYS = new Set<string>([
  '2026-01-01',
  '2026-01-06',
  '2026-04-03',
  '2026-04-21',
  '2026-05-01',
  '2026-09-07',
  '2026-10-03',
  '2026-10-12',
  '2026-11-02',
  '2026-11-15',
  '2026-11-20',
  '2026-11-21',
  '2026-12-25',
  '2027-01-01',
  '2027-01-06',
  '2027-03-26',
  '2027-04-21',
  '2027-05-01',
  '2027-09-07',
  '2027-10-03',
  '2027-10-12',
  '2027-11-02',
  '2027-11-15',
  '2027-11-20',
  '2027-11-21',
  '2027-12-25',
]);

export const FORTALEZA_CALENDAR: BusinessCalendar = {
  utcOffsetMinutes: -180,
  startHour: 8,
  endHour: 18,
  holidays: HOLIDAYS,
};

interface SlaTarget {
  responseMinutes: number;
  resolutionMinutes: number;
  /** true = minutos corridos (24x7); false = minutos úteis. */
  continuous: boolean;
}

export const SLA_TARGETS: Record<Priority, SlaTarget> = {
  P1: { responseMinutes: 30, resolutionMinutes: 4 * 60, continuous: true },
  P2: { responseMinutes: 2 * 60, resolutionMinutes: 8 * 60, continuous: false },
  P3: { responseMinutes: 4 * 60, resolutionMinutes: 20 * 60, continuous: false },
  P4: { responseMinutes: 10 * 60, resolutionMinutes: 30 * 60, continuous: false },
};

const MINUTE = 60_000;

// Trabalhamos com um "relógio local": Date cujo valor UTC representa a hora local.
const toLocal = (d: Date, cal: BusinessCalendar) =>
  new Date(d.getTime() + cal.utcOffsetMinutes * MINUTE);
const fromLocal = (d: Date, cal: BusinessCalendar) =>
  new Date(d.getTime() - cal.utcOffsetMinutes * MINUTE);
const dateKey = (local: Date) => local.toISOString().slice(0, 10);

function isBusinessDay(local: Date, cal: BusinessCalendar) {
  const dow = local.getUTCDay();
  return dow !== 0 && dow !== 6 && !cal.holidays.has(dateKey(local));
}

function atHour(local: Date, hour: number) {
  const d = new Date(local);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

function nextBusinessDayStart(local: Date, cal: BusinessCalendar) {
  let d = atHour(local, cal.startHour);
  do d = new Date(d.getTime() + 24 * 60 * MINUTE);
  while (!isBusinessDay(d, cal));
  return d;
}

/** Leva um instante local para o próximo momento dentro do expediente (ou mantém, se já estiver). */
function alignToBusinessTime(local: Date, cal: BusinessCalendar): Date {
  if (!isBusinessDay(local, cal)) {
    const d = atHour(local, cal.startHour);
    return isBusinessDay(d, cal) ? d : nextBusinessDayStart(d, cal);
  }
  if (local < atHour(local, cal.startHour)) return atHour(local, cal.startHour);
  if (local >= atHour(local, cal.endHour)) return nextBusinessDayStart(local, cal);
  return local;
}

/** Soma minutos úteis a um instante (UTC), respeitando expediente, fins de semana e feriados. */
export function addBusinessMinutes(
  start: Date,
  minutes: number,
  cal: BusinessCalendar = FORTALEZA_CALENDAR,
): Date {
  let cursor = alignToBusinessTime(toLocal(start, cal), cal);
  let remaining = minutes;
  for (;;) {
    const available = (atHour(cursor, cal.endHour).getTime() - cursor.getTime()) / MINUTE;
    if (remaining <= available)
      return fromLocal(new Date(cursor.getTime() + remaining * MINUTE), cal);
    remaining -= available;
    cursor = nextBusinessDayStart(cursor, cal);
  }
}

export interface SlaDeadlines {
  responseDueAt: Date;
  resolutionDueAt: Date;
}

/** Prazos de 1ª resposta e resolução de um chamado aberto em `openedAt` com a prioridade dada. */
export function calculateSlaDeadlines(
  openedAt: Date,
  priority: Priority,
  cal: BusinessCalendar = FORTALEZA_CALENDAR,
): SlaDeadlines {
  const t = SLA_TARGETS[priority];
  if (t.continuous) {
    return {
      responseDueAt: new Date(openedAt.getTime() + t.responseMinutes * MINUTE),
      resolutionDueAt: new Date(openedAt.getTime() + t.resolutionMinutes * MINUTE),
    };
  }
  return {
    responseDueAt: addBusinessMinutes(openedAt, t.responseMinutes, cal),
    resolutionDueAt: addBusinessMinutes(openedAt, t.resolutionMinutes, cal),
  };
}

export type SlaState = 'ON_TRACK' | 'AT_RISK' | 'VIOLATED' | 'MET';

export interface SlaTicketView {
  createdAt: Date;
  responseDueAt: Date;
  resolutionDueAt: Date;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
}

/** Fração do prazo (tempo de relógio) a partir da qual o chamado é considerado "em risco". */
export const AT_RISK_THRESHOLD = 0.75;

/**
 * Indicador de SLA para a fila de chamados:
 * - resolvido: MET ou VIOLATED conforme resolveu dentro do prazo (e respondeu no prazo);
 * - em aberto: VIOLATED se algum prazo vigente passou; AT_RISK se ≥75% do tempo consumido.
 */
export function slaState(t: SlaTicketView, now: Date = new Date()): SlaState {
  const responseLate = t.firstResponseAt
    ? t.firstResponseAt > t.responseDueAt
    : now > t.responseDueAt;
  if (t.resolvedAt) {
    return responseLate || t.resolvedAt > t.resolutionDueAt ? 'VIOLATED' : 'MET';
  }
  if (responseLate || now > t.resolutionDueAt) return 'VIOLATED';
  const due = t.firstResponseAt ? t.resolutionDueAt : t.responseDueAt;
  const total = due.getTime() - t.createdAt.getTime();
  const used = now.getTime() - t.createdAt.getTime();
  return total > 0 && used / total >= AT_RISK_THRESHOLD ? 'AT_RISK' : 'ON_TRACK';
}

/** Formata um prazo para mensagens ao usuário (horário de Fortaleza). */
export function formatDeadline(d: Date): string {
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Fortaleza',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}
