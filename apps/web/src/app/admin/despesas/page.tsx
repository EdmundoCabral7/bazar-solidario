'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { AdminTitle } from '@/components/admin/admin-shell';
import { DataTable, Td } from '@/components/admin/data-table';
import { Pager } from '@/components/admin/pager';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { errorMessage, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { EXPENSE_CATEGORIES } from '@/lib/labels';
import type { Page } from '@/lib/types';
import { formatBRL, formatDate } from '@/lib/utils';

interface Expense {
  id: string;
  category: string;
  description: string;
  amountCents: number;
  spentAt: string;
}

const formSchema = z.object({
  category: z.enum(['RACAO', 'VETERINARIO', 'CASTRACAO', 'MANUTENCAO', 'OUTROS']),
  description: z.string().trim().min(3, 'Descreva a despesa'),
  amount: z.coerce.number().positive('Informe o valor'),
  spentAt: z.string().min(10, 'Informe a data'),
});
type FormValues = z.input<typeof formSchema>;

export default function ExpensesPage() {
  const { request } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const today = new Date().toISOString().slice(0, 10);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { category: 'RACAO', spentAt: today },
  });
  const { data, error } = useQuery({
    queryKey: ['admin-expenses', page],
    queryFn: () => request<Page<Expense>>(`/api/admin/expenses${qs({ page, pageSize: 20 })}`),
  });
  const create = useMutation({
    mutationFn: (v: FormValues) => {
      const p = formSchema.parse(v);
      return request('/api/admin/expenses', {
        method: 'POST',
        body: JSON.stringify({
          category: p.category,
          description: p.description,
          amountCents: Math.round(p.amount * 100),
          spentAt: `${p.spentAt}T12:00:00-03:00`,
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-expenses'] });
      reset({ category: 'RACAO', spentAt: today, description: '', amount: undefined });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => request(`/api/admin/expenses/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-expenses'] }),
  });

  return (
    <>
      <AdminTitle
        title="Despesas"
        description="Tudo o que é lançado aqui aparece, agregado por categoria, no painel público de transparência."
      />
      <form
        onSubmit={handleSubmit((v) => create.mutate(v))}
        noValidate
        className="mb-6 grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-[160px_1fr_140px_160px_auto] sm:items-end"
      >
        <Field id="category" label="Categoria">
          <Select {...register('category')}>
            {Object.entries(EXPENSE_CATEGORIES).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="description" label="Descrição" error={errors.description?.message}>
          <Input {...register('description')} />
        </Field>
        <Field id="amount" label="Valor (R$)" error={errors.amount?.message}>
          <Input type="number" step="0.01" min={0} {...register('amount')} />
        </Field>
        <Field id="spentAt" label="Data" error={errors.spentAt?.message}>
          <Input type="date" {...register('spentAt')} />
        </Field>
        <Button type="submit" disabled={create.isPending}>
          Lançar
        </Button>
      </form>
      {(error || create.error || remove.error) && (
        <Alert tone="danger" className="mb-3">
          {errorMessage(error ?? create.error ?? remove.error)}
        </Alert>
      )}
      <DataTable caption="Despesas" headers={['Data', 'Categoria', 'Descrição', 'Valor', '']}>
        {data?.data.map((e) => (
          <tr key={e.id}>
            <Td>{formatDate(e.spentAt)}</Td>
            <Td>{EXPENSE_CATEGORIES[e.category]}</Td>
            <Td>{e.description}</Td>
            <Td className="tabular-nums">{formatBRL(e.amountCents)}</Td>
            <Td>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => confirm('Excluir esta despesa?') && remove.mutate(e.id)}
              >
                Excluir
              </Button>
            </Td>
          </tr>
        ))}
      </DataTable>
      {data && <Pager page={data.page} totalPages={data.totalPages} onChange={setPage} />}
    </>
  );
}
