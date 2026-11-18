import { prisma } from '../../lib/prisma';

const TZ = 'America/Fortaleza';

/** Primeiro dia do mês local (Fortaleza) de `monthsBack` meses atrás, em UTC. */
function monthStart(monthsBack: number, now = new Date()) {
  const local = new Date(now.getTime() - 3 * 3600_000);
  const d = new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - monthsBack, 1, 3, 0, 0),
  );
  return d;
}

interface RaisedRow {
  month: string;
  source: 'SALES' | 'DONATIONS' | 'SPONSORSHIPS';
  cents: bigint;
}
interface SpentRow {
  month: string;
  category: string;
  cents: bigint;
}

/**
 * Painel de transparência: arrecadado (pagamentos aprovados, por origem) × gasto (despesas,
 * por categoria), mês a mês no fuso de Fortaleza. Somente dados agregados — nenhum dado pessoal.
 */
export async function transparencyReport(months: number) {
  const from = monthStart(months - 1);

  const raised = await prisma.$queryRaw<RaisedRow[]>`
    SELECT to_char(("paidAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}, 'YYYY-MM') AS month,
           CASE WHEN "orderId" IS NOT NULL THEN 'SALES'
                WHEN "donationId" IS NOT NULL THEN 'DONATIONS'
                ELSE 'SPONSORSHIPS' END AS source,
           SUM("amountCents")::bigint AS cents
      FROM "Payment"
     WHERE status = 'APPROVED' AND "paidAt" >= ${from}
     GROUP BY 1, 2`;

  const spent = await prisma.$queryRaw<SpentRow[]>`
    SELECT to_char(("spentAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}, 'YYYY-MM') AS month,
           category::text AS category,
           SUM("amountCents")::bigint AS cents
      FROM "Expense"
     WHERE "spentAt" >= ${from}
     GROUP BY 1, 2`;

  const monthKeys = Array.from({ length: months }, (_, i) => {
    const d = monthStart(months - 1 - i);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });

  const series = monthKeys.map((month) => {
    const r = raised.filter((x) => x.month === month);
    const s = spent.filter((x) => x.month === month);
    const bySource = (src: RaisedRow['source']) =>
      Number(r.find((x) => x.source === src)?.cents ?? 0);
    const raisedCents = {
      sales: bySource('SALES'),
      donations: bySource('DONATIONS'),
      sponsorships: bySource('SPONSORSHIPS'),
    };
    const raisedTotal = raisedCents.sales + raisedCents.donations + raisedCents.sponsorships;
    const spentByCategory = Object.fromEntries(s.map((x) => [x.category, Number(x.cents)]));
    const spentTotal = s.reduce((acc, x) => acc + Number(x.cents), 0);
    return {
      month,
      raisedCents: { ...raisedCents, total: raisedTotal },
      spentCents: { byCategory: spentByCategory, total: spentTotal },
      balanceCents: raisedTotal - spentTotal,
    };
  });

  const spentByCategory: Record<string, number> = {};
  for (const row of spent)
    spentByCategory[row.category] = (spentByCategory[row.category] ?? 0) + Number(row.cents);

  const [activeSponsorships, adoptedAnimals, availableAnimals] = await Promise.all([
    prisma.sponsorship.count({ where: { status: 'ACTIVE' } }),
    prisma.animal.count({ where: { status: 'ADOPTED' } }),
    prisma.animal.count({ where: { status: { in: ['AVAILABLE', 'IN_ADOPTION'] } } }),
  ]);

  const totalRaised = series.reduce((a, m) => a + m.raisedCents.total, 0);
  const totalSpent = series.reduce((a, m) => a + m.spentCents.total, 0);

  return {
    period: { from, months },
    totals: {
      raisedCents: totalRaised,
      spentCents: totalSpent,
      balanceCents: totalRaised - totalSpent,
    },
    spentByCategory,
    months: series,
    impact: { activeSponsorships, adoptedAnimals, availableAnimals },
  };
}
