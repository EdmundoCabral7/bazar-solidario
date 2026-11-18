'use client';

import { Fragment, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminTitle } from '@/components/admin/admin-shell';
import { DataTable, Td } from '@/components/admin/data-table';
import { Pager } from '@/components/admin/pager';
import { StatusBadge } from '@/components/status-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ADOPTION_STATUS } from '@/lib/labels';
import type { Page } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

interface AdoptionRequest {
  id: string;
  publicCode: string;
  status: keyof typeof ADOPTION_STATUS;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  city: string;
  answers: Record<string, unknown>;
  notes: string | null;
  createdAt: string;
  animal: { id: string; slug: string; name: string; status: string };
}

const NEXT: Record<string, { status: string; label: string }[]> = {
  RECEIVED: [{ status: 'IN_REVIEW', label: 'Iniciar análise' }],
  IN_REVIEW: [{ status: 'INTERVIEW', label: 'Chamar para entrevista' }],
  INTERVIEW: [{ status: 'APPROVED', label: 'Aprovar adoção' }],
};

const ANSWER_LABELS: Record<string, string> = {
  housingType: 'Moradia',
  ownsHome: 'Imóvel próprio',
  hasYard: 'Quintal/área telada',
  hasOtherPets: 'Outros animais',
  otherPetsDescription: 'Quais',
  hasChildren: 'Crianças',
  hoursAlonePerDay: 'Horas sozinho/dia',
  allResidentsAgree: 'Moradores concordam',
  canAffordCosts: 'Arca com custos',
  motivation: 'Motivação',
};
const fmt = (v: unknown) =>
  v === true
    ? 'Sim'
    : v === false
      ? 'Não'
      : v === 'HOUSE'
        ? 'Casa'
        : v === 'APARTMENT'
          ? 'Apartamento'
          : v === 'OTHER'
            ? 'Outro'
            : String(v ?? '—');

function Triage({ r }: { r: AdoptionRequest }) {
  const { request } = useAuth();
  const qc = useQueryClient();
  const [notes, setNotes] = useState(r.notes ?? '');
  const update = useMutation({
    mutationFn: (status: string) =>
      request(`/api/admin/adoptions/${r.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, notes: notes || undefined }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-adoptions'] }),
  });
  const open = ['RECEIVED', 'IN_REVIEW', 'INTERVIEW'].includes(r.status);
  return (
    <div className="grid gap-4 p-4 md:grid-cols-2">
      <div className="space-y-2 text-sm">
        <p>
          <strong>{r.applicantName}</strong> · {r.applicantEmail} · {r.applicantPhone} · {r.city}
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {Object.entries(ANSWER_LABELS)
            .filter(([k]) => r.answers[k] !== undefined)
            .map(([k, l]) => (
              <Fragment key={k}>
                <dt className="text-muted-foreground">{l}</dt>
                <dd>{fmt(r.answers[k])}</dd>
              </Fragment>
            ))}
        </dl>
      </div>
      <div className="space-y-3">
        <Field id={`notas-${r.id}`} label="Anotações internas">
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={!open}
          />
        </Field>
        {open && (
          <div className="flex flex-wrap gap-2">
            {NEXT[r.status]?.map((a) => (
              <Button
                key={a.status}
                size="sm"
                disabled={update.isPending}
                onClick={() => update.mutate(a.status)}
              >
                {a.label}
              </Button>
            ))}
            <Button
              size="sm"
              variant="outline"
              disabled={update.isPending}
              onClick={() => confirm('Recusar esta solicitação?') && update.mutate('REJECTED')}
            >
              Recusar
            </Button>
          </div>
        )}
        {r.status === 'INTERVIEW' && (
          <p className="text-xs text-muted-foreground">
            Ao aprovar, {r.animal.name} fica como adotado(a) e as demais solicitações abertas são
            recusadas.
          </p>
        )}
        {update.error && <Alert tone="danger">{errorMessage(update.error)}</Alert>}
      </div>
    </div>
  );
}

export default function AdminAdoptionsPage() {
  const { request } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const { data, error } = useQuery({
    queryKey: ['admin-adoptions', page, status],
    queryFn: () =>
      request<Page<AdoptionRequest>>(`/api/admin/adoptions${qs({ page, pageSize: 20, status })}`),
  });

  return (
    <>
      <AdminTitle
        title="Adoções"
        description="Triagem: recebida → análise → entrevista → aprovada. O interessado é notificado a cada etapa."
      />
      <div className="mb-3 max-w-xs">
        <Field id="filtro" label="Status">
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            {Object.entries(ADOPTION_STATUS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {error && <Alert tone="danger">{errorMessage(error)}</Alert>}
      <DataTable
        caption="Solicitações de adoção"
        headers={['Protocolo', 'Data', 'Animal', 'Interessado', 'Status', '']}
      >
        {data?.data.map((r) => (
          <Fragment key={r.id}>
            <tr>
              <Td className="font-mono">{r.publicCode}</Td>
              <Td>{formatDateTime(r.createdAt)}</Td>
              <Td>{r.animal.name}</Td>
              <Td>{r.applicantName}</Td>
              <Td>
                <StatusBadge kind="adoption" value={r.status} />
              </Td>
              <Td>
                <Button
                  size="sm"
                  variant="outline"
                  aria-expanded={open === r.id}
                  onClick={() => setOpen(open === r.id ? null : r.id)}
                >
                  {open === r.id ? 'Fechar' : 'Analisar'}
                </Button>
              </Td>
            </tr>
            {open === r.id && (
              <tr>
                <td colSpan={6} className="bg-muted/30">
                  <Triage r={r} />
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </DataTable>
      {data && <Pager page={data.page} totalPages={data.totalPages} onChange={setPage} />}
    </>
  );
}
