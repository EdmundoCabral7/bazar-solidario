import { computePriority } from '@bazar/shared';
import { describe, expect, it } from 'vitest';
import { addBusinessMinutes, calculateSlaDeadlines, slaState } from '../src/modules/tickets/sla';

/** Cria um Date a partir de hora local de Fortaleza (UTC−3). */
const local = (iso: string) => new Date(`${iso}-03:00`);

// Datas de referência (novembro/2026): 16/11 segunda; 20/11 sexta = feriado (Consciência Negra);
// 21/11 sábado; 23/11 segunda; 25/11 quarta.

describe('matriz impacto × urgência', () => {
  it.each([
    ['HIGH', 'HIGH', 'P1'],
    ['HIGH', 'MEDIUM', 'P2'],
    ['MEDIUM', 'HIGH', 'P2'],
    ['HIGH', 'LOW', 'P3'],
    ['MEDIUM', 'MEDIUM', 'P3'],
    ['LOW', 'HIGH', 'P3'],
    ['MEDIUM', 'LOW', 'P4'],
    ['LOW', 'MEDIUM', 'P4'],
    ['LOW', 'LOW', 'P4'],
  ] as const)('impacto %s + urgência %s = %s', (impact, urgency, expected) => {
    expect(computePriority(impact, urgency)).toBe(expected);
  });
});

describe('addBusinessMinutes', () => {
  it('soma dentro do mesmo expediente', () => {
    expect(addBusinessMinutes(local('2026-11-25T09:00'), 120)).toEqual(local('2026-11-25T11:00'));
  });

  it('termina exatamente às 18h sem pular de dia', () => {
    expect(addBusinessMinutes(local('2026-11-25T16:00'), 120)).toEqual(local('2026-11-25T18:00'));
  });

  it('transborda para o dia útil seguinte', () => {
    expect(addBusinessMinutes(local('2026-11-25T17:00'), 120)).toEqual(local('2026-11-26T09:00'));
  });

  it('abertura antes das 8h começa a contar às 8h', () => {
    expect(addBusinessMinutes(local('2026-11-25T06:30'), 60)).toEqual(local('2026-11-25T09:00'));
  });

  it('abertura depois das 18h começa no dia útil seguinte', () => {
    expect(addBusinessMinutes(local('2026-11-24T19:00'), 60)).toEqual(local('2026-11-25T09:00'));
  });

  it('pula o fim de semana', () => {
    // sábado 28/11 → segunda 30/11 08h + 2h
    expect(addBusinessMinutes(local('2026-11-28T10:00'), 120)).toEqual(local('2026-11-30T10:00'));
    // sexta 27/11 17h + 2h → segunda 30/11 09h
    expect(addBusinessMinutes(local('2026-11-27T17:00'), 120)).toEqual(local('2026-11-30T09:00'));
  });

  it('pula feriado (20/11, Consciência Negra) e o fim de semana seguinte', () => {
    // quinta 19/11 17h + 2h → (sexta feriado, sáb, dom) → segunda 23/11 09h
    expect(addBusinessMinutes(local('2026-11-19T17:00'), 120)).toEqual(local('2026-11-23T09:00'));
  });

  it('atravessa vários dias úteis', () => {
    // 30 h úteis a partir de segunda 16/11 08h = seg, ter, qua inteiras → quarta 18h
    expect(addBusinessMinutes(local('2026-11-16T08:00'), 30 * 60)).toEqual(
      local('2026-11-18T18:00'),
    );
  });

  it('o resultado é um instante UTC correto (UTC−3)', () => {
    expect(addBusinessMinutes(local('2026-11-25T09:00'), 60).toISOString()).toBe(
      '2026-11-25T13:00:00.000Z',
    );
  });
});

describe('calculateSlaDeadlines', () => {
  it('P1 usa horas corridas, inclusive no fim de semana', () => {
    const opened = local('2026-11-28T23:00'); // sábado à noite
    const d = calculateSlaDeadlines(opened, 'P1');
    expect(d.responseDueAt).toEqual(local('2026-11-28T23:30'));
    expect(d.resolutionDueAt).toEqual(local('2026-11-29T03:00'));
  });

  it('P2: 2 h úteis de resposta e 8 h úteis de resolução', () => {
    const d = calculateSlaDeadlines(local('2026-11-25T14:00'), 'P2');
    expect(d.responseDueAt).toEqual(local('2026-11-25T16:00'));
    expect(d.resolutionDueAt).toEqual(local('2026-11-26T12:00'));
  });

  it('P3: 4 h úteis e 2 dias úteis (20 h)', () => {
    const d = calculateSlaDeadlines(local('2026-11-25T10:00'), 'P3');
    expect(d.responseDueAt).toEqual(local('2026-11-25T14:00'));
    expect(d.resolutionDueAt).toEqual(local('2026-11-27T10:00'));
  });

  it('P4 aberto na sexta à tarde: 1 dia útil e 3 dias úteis contados a partir de segunda', () => {
    const d = calculateSlaDeadlines(local('2026-11-27T16:00'), 'P4');
    // 2 h na sexta + 8 h na segunda
    expect(d.responseDueAt).toEqual(local('2026-11-30T16:00'));
    // 2 h sex + 10 seg + 10 ter + 8 qua
    expect(d.resolutionDueAt).toEqual(local('2026-12-02T16:00'));
  });

  it('P2 aberto no feriado começa a contar no próximo dia útil', () => {
    const d = calculateSlaDeadlines(local('2026-11-20T10:00'), 'P2');
    expect(d.responseDueAt).toEqual(local('2026-11-23T10:00'));
  });
});

describe('slaState', () => {
  const base = {
    createdAt: local('2026-11-25T08:00'),
    responseDueAt: local('2026-11-25T10:00'),
    resolutionDueAt: local('2026-11-25T16:00'),
    firstResponseAt: null as Date | null,
    resolvedAt: null as Date | null,
  };

  it('no prazo', () => expect(slaState(base, local('2026-11-25T08:30'))).toBe('ON_TRACK'));
  it('em risco após 75% do prazo de resposta', () =>
    expect(slaState(base, local('2026-11-25T09:40'))).toBe('AT_RISK'));
  it('violado sem resposta após o prazo', () =>
    expect(slaState(base, local('2026-11-25T10:01'))).toBe('VIOLATED'));
  it('após responder, mede contra o prazo de resolução', () =>
    expect(
      slaState({ ...base, firstResponseAt: local('2026-11-25T09:00') }, local('2026-11-25T11:00')),
    ).toBe('ON_TRACK'));
  it('resolvido no prazo = MET', () =>
    expect(
      slaState({
        ...base,
        firstResponseAt: local('2026-11-25T09:00'),
        resolvedAt: local('2026-11-25T15:00'),
      }),
    ).toBe('MET'));
  it('resolvido fora do prazo = VIOLATED', () =>
    expect(
      slaState({
        ...base,
        firstResponseAt: local('2026-11-25T09:00'),
        resolvedAt: local('2026-11-25T17:00'),
      }),
    ).toBe('VIOLATED'));
});
