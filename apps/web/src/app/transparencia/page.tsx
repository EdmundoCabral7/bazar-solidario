import type { Metadata } from 'next';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { serverGet } from '@/lib/api';
import { EXPENSE_CATEGORIES } from '@/lib/labels';
import type { Transparency } from '@/lib/types';
import { formatBRL, formatMonth } from '@/lib/utils';
import { CategoryChart, MonthlyChart } from './charts';

export const metadata: Metadata = {
  title: 'Transparência',
  description:
    'Quanto a Associação Patas Potiguares arrecadou e como cada real foi usado, mês a mês.',
};
export const revalidate = 60;

export default async function TransparencyPage() {
  const data = await serverGet<Transparency>('/api/transparency?months=6', 60);
  if (!data) {
    return (
      <div className="mx-auto max-w-6xl px-4">
        <PageHeader title="Transparência" />
        <EmptyState title="Não foi possível carregar os dados agora" />
      </div>
    );
  }

  const monthly = data.months.map((m) => ({
    month: formatMonth(m.month),
    raised: m.raisedCents.total,
    spent: m.spentCents.total,
  }));
  const categories = Object.entries(data.spentByCategory)
    .map(([k, v]) => ({ category: EXPENSE_CATEGORIES[k] ?? k, cents: v }))
    .sort((a, b) => b.cents - a.cents);
  const sources = data.months.reduce(
    (acc, m) => ({
      sales: acc.sales + m.raisedCents.sales,
      donations: acc.donations + m.raisedCents.donations,
      sponsorships: acc.sponsorships + m.raisedCents.sponsorships,
    }),
    { sales: 0, donations: 0, sponsorships: 0 },
  );

  const tiles = [
    { label: 'Arrecadado (6 meses)', value: formatBRL(data.totals.raisedCents) },
    { label: 'Investido nos animais', value: formatBRL(data.totals.spentCents) },
    { label: 'Saldo do período', value: formatBRL(data.totals.balanceCents) },
    { label: 'Padrinhos ativos', value: String(data.impact.activeSponsorships) },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4">
      <PageHeader
        title="Transparência"
        description="Prestação de contas aberta: tudo o que entra (bazar, doações e apadrinhamentos) e tudo o que sai, por mês e por categoria. Valores agregados — nenhum doador é identificado."
      />

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border border-border bg-card p-4">
            <dt className="text-sm text-muted-foreground">{t.label}</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums">{t.value}</dd>
          </div>
        ))}
      </dl>

      <section
        aria-labelledby="mensal"
        className="mt-8 rounded-lg border border-border bg-card p-5"
      >
        <h2 id="mensal" className="font-semibold">
          Arrecadado × gasto por mês
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Origem da arrecadação no período: bazar {formatBRL(sources.sales)} · doações{' '}
          {formatBRL(sources.donations)} · apadrinhamentos {formatBRL(sources.sponsorships)}.
        </p>
        <MonthlyChart data={monthly} />
      </section>

      <section
        aria-labelledby="categorias"
        className="mt-6 rounded-lg border border-border bg-card p-5"
      >
        <h2 id="categorias" className="mb-4 font-semibold">
          Para onde foi o dinheiro
        </h2>
        {categories.length ? (
          <CategoryChart data={categories} />
        ) : (
          <p className="text-sm text-muted-foreground">Sem despesas no período.</p>
        )}
      </section>

      <details className="mt-6 rounded-lg border border-border bg-card p-5">
        <summary className="cursor-pointer font-semibold">Ver os números em tabela</summary>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Arrecadação e gastos por mês, em reais</caption>
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="py-2">
                  Mês
                </th>
                <th scope="col" className="py-2 text-right">
                  Bazar
                </th>
                <th scope="col" className="py-2 text-right">
                  Doações
                </th>
                <th scope="col" className="py-2 text-right">
                  Apadrinhamentos
                </th>
                <th scope="col" className="py-2 text-right">
                  Total arrecadado
                </th>
                <th scope="col" className="py-2 text-right">
                  Gasto
                </th>
                <th scope="col" className="py-2 text-right">
                  Saldo
                </th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {data.months.map((m) => (
                <tr key={m.month} className="border-b border-border/60">
                  <th scope="row" className="py-2 text-left font-normal">
                    {formatMonth(m.month)}
                  </th>
                  <td className="py-2 text-right">{formatBRL(m.raisedCents.sales)}</td>
                  <td className="py-2 text-right">{formatBRL(m.raisedCents.donations)}</td>
                  <td className="py-2 text-right">{formatBRL(m.raisedCents.sponsorships)}</td>
                  <td className="py-2 text-right font-medium">{formatBRL(m.raisedCents.total)}</td>
                  <td className="py-2 text-right">{formatBRL(m.spentCents.total)}</td>
                  <td className="py-2 text-right">{formatBRL(m.balanceCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
