'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminTitle } from '@/components/admin/admin-shell';
import { DataTable, Td } from '@/components/admin/data-table';
import { StatusBadge } from '@/components/status-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { errorMessage, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime, formatMinutes } from '@/lib/utils';

interface Bucket {
  total: number;
  response: {
    met: number;
    violated: number;
    pending: number;
    compliancePct: number | null;
    avgMinutes: number | null;
  };
  resolution: {
    met: number;
    violated: number;
    pending: number;
    compliancePct: number | null;
    avgMinutes: number | null;
  };
}
interface Report {
  overall: Bucket;
  byPriority: Record<string, Bucket>;
  byService: { code: string; name: string; total: number; violated: number }[];
  violations: {
    protocol: string;
    title: string;
    priority: string;
    service: string;
    status: string;
    violated: string[];
    createdAt: string;
  }[];
}

const pct = (v: number | null) => (v === null ? '—' : `${v.toLocaleString('pt-BR')}%`);
const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10);

export default function SlaReportPage() {
  const { request } = useAuth();
  const [range, setRange] = useState({
    from: daysAgo(30),
    to: new Date().toISOString().slice(0, 10),
  });
  const [applied, setApplied] = useState(range);
  const { data, error, isFetching } = useQuery({
    queryKey: ['sla-report', applied],
    queryFn: () =>
      request<Report>(
        `/api/tickets/sla-report${qs({ from: `${applied.from}T00:00:00-03:00`, to: `${applied.to}T23:59:59-03:00` })}`,
      ),
  });

  return (
    <>
      <AdminTitle
        title="Relatório de SLA"
        description="Conformidade = cumpridos ÷ (cumpridos + violados). Chamados ainda dentro do prazo contam como pendentes."
      >
        <Button variant="outline" onClick={() => window.print()}>
          Imprimir / salvar PDF
        </Button>
      </AdminTitle>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(range);
        }}
        className="mb-6 flex flex-wrap items-end gap-3"
      >
        <Field id="de" label="De">
          <Input
            type="date"
            value={range.from}
            onChange={(e) => setRange({ ...range, from: e.target.value })}
          />
        </Field>
        <Field id="ate" label="Até">
          <Input
            type="date"
            value={range.to}
            onChange={(e) => setRange({ ...range, to: e.target.value })}
          />
        </Field>
        <Button type="submit" disabled={isFetching}>
          Gerar
        </Button>
      </form>
      {error && <Alert tone="danger">{errorMessage(error)}</Alert>}
      {data && (
        <div className="space-y-6">
          <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              ['Chamados no período', String(data.overall.total)],
              ['1ª resposta no prazo', pct(data.overall.response.compliancePct)],
              ['Resolução no prazo', pct(data.overall.resolution.compliancePct)],
              ['Chamados com violação', String(data.violations.length)],
            ].map(([l, v]) => (
              <div key={l} className="rounded-lg border border-border bg-card p-4">
                <dt className="text-sm text-muted-foreground">{l}</dt>
                <dd className="text-2xl font-bold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>

          <section>
            <h2 className="mb-2 font-semibold">Por prioridade</h2>
            <DataTable
              caption="SLA por prioridade"
              headers={[
                'Prioridade',
                'Total',
                '1ª resposta no prazo',
                'Tempo médio de resposta',
                'Resolução no prazo',
                'Tempo médio de resolução',
                'Pendentes',
              ]}
            >
              {Object.entries(data.byPriority).map(([p, b]) => (
                <tr key={p}>
                  <Td>
                    <StatusBadge kind="priority" value={p} />
                  </Td>
                  <Td>{b.total}</Td>
                  <Td>
                    {pct(b.response.compliancePct)}{' '}
                    <span className="text-xs text-muted-foreground">
                      ({b.response.met}/{b.response.met + b.response.violated})
                    </span>
                  </Td>
                  <Td>{formatMinutes(b.response.avgMinutes)}</Td>
                  <Td>
                    {pct(b.resolution.compliancePct)}{' '}
                    <span className="text-xs text-muted-foreground">
                      ({b.resolution.met}/{b.resolution.met + b.resolution.violated})
                    </span>
                  </Td>
                  <Td>{formatMinutes(b.resolution.avgMinutes)}</Td>
                  <Td>{b.resolution.pending}</Td>
                </tr>
              ))}
            </DataTable>
          </section>

          <section>
            <h2 className="mb-2 font-semibold">Por serviço do catálogo</h2>
            <DataTable caption="SLA por serviço" headers={['Serviço', 'Chamados', 'Com violação']}>
              {data.byService.map((s) => (
                <tr key={s.code}>
                  <Td>
                    {s.code} — {s.name}
                  </Td>
                  <Td>{s.total}</Td>
                  <Td>{s.violated}</Td>
                </tr>
              ))}
            </DataTable>
          </section>

          <section>
            <h2 className="mb-2 font-semibold">Chamados com SLA violado</h2>
            <DataTable
              caption="Violações"
              headers={[
                'Protocolo',
                'Aberto em',
                'Título',
                'Serviço',
                'Prioridade',
                'Prazo violado',
              ]}
            >
              {data.violations.map((v) => (
                <tr key={v.protocol}>
                  <Td className="font-mono text-xs">{v.protocol}</Td>
                  <Td>{formatDateTime(v.createdAt)}</Td>
                  <Td>{v.title}</Td>
                  <Td>{v.service}</Td>
                  <Td>
                    <StatusBadge kind="priority" value={v.priority} />
                  </Td>
                  <Td>
                    {v.violated
                      .map((x) => (x === 'RESPONSE' ? '1ª resposta' : 'Resolução'))
                      .join(' e ')}
                  </Td>
                </tr>
              ))}
            </DataTable>
          </section>
        </div>
      )}
    </>
  );
}
