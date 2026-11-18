'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { formatBRL } from '@/lib/utils';

const compactBRL = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  });

const axisTick = { fill: 'var(--muted-foreground)', fontSize: 12 };

function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block size-2.5 rounded-sm"
            style={{ background: p.color }}
          />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium tabular-nums">{formatBRL(Number(p.value))}</span>
        </p>
      ))}
    </div>
  );
}

/** Barras agrupadas (2 séries, um eixo): arrecadado × gasto por mês. */
export function MonthlyChart({
  data,
}: {
  data: { month: string; raised: number; spent: number }[];
}) {
  return (
    <div
      className="h-72 w-full"
      role="img"
      aria-label="Gráfico de barras: arrecadado e gasto por mês. Os valores estão na tabela abaixo."
    >
      <ResponsiveContainer>
        <BarChart
          data={data}
          barGap={2}
          barCategoryGap="25%"
          margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
        >
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="month" tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis
            tickFormatter={compactBRL}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.6 }} />
          <Legend
            verticalAlign="top"
            align="left"
            height={32}
            iconType="square"
            formatter={(value) => <span style={{ color: 'var(--foreground)' }}>{value}</span>}
          />
          <Bar
            dataKey="raised"
            name="Arrecadado"
            fill="var(--series-1)"
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
            isAnimationActive={false}
          />
          <Bar
            dataKey="spent"
            name="Gasto"
            fill="var(--series-2)"
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Barras horizontais, série única (magnitude), ordenadas; rótulo de valor ao fim de cada barra. */
export function CategoryChart({ data }: { data: { category: string; cents: number }[] }) {
  return (
    <div
      className="w-full"
      style={{ height: data.length * 44 + 16 }}
      role="img"
      aria-label="Gastos por categoria no período. Os valores estão escritos ao lado de cada barra."
    >
      <ResponsiveContainer>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 96, left: 8, bottom: 0 }}
          barCategoryGap={10}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="category"
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={96}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.6 }} />
          <Bar
            dataKey="cents"
            name="Gasto"
            fill="var(--series-1)"
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
            label={{
              position: 'right',
              formatter: (v: number) => formatBRL(v),
              fill: 'var(--foreground)',
              fontSize: 12,
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
