'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { animalInputSchema } from '@bazar/shared';
import { AdminTitle } from '@/components/admin/admin-shell';
import { DataTable, Td } from '@/components/admin/data-table';
import { Pager } from '@/components/admin/pager';
import { StatusBadge } from '@/components/status-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ANIMAL_STATUS, SEXES, SIZES, SPECIES } from '@/lib/labels';
import type { Animal, Page } from '@/lib/types';
import { formatAge } from '@/lib/utils';

const formSchema = animalInputSchema.omit({ photos: true }).extend({
  ageMonths: z.coerce.number().int().min(0, 'Idade inválida').max(360),
  photosText: z.string().optional(),
});
type FormValues = z.input<typeof formSchema>;

function AnimalForm({ animal, onDone }: { animal: Animal | null; onDone: () => void }) {
  const { request } = useAuth();
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: animal
      ? { ...animal, photosText: animal.photos.join('\n') }
      : {
          species: 'DOG',
          size: 'MEDIUM',
          sex: 'MALE',
          status: 'AVAILABLE',
          neutered: false,
          vaccinated: false,
          ageMonths: 12,
        },
  });
  const save = useMutation({
    mutationFn: (v: FormValues) => {
      const parsed = formSchema.parse(v);
      const { photosText, ...rest } = parsed;
      const body = {
        ...rest,
        photos: (photosText ?? '')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      };
      return animal
        ? request(`/api/admin/animals/${animal.id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          })
        : request('/api/admin/animals', { method: 'POST', body: JSON.stringify(body) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-animals'] });
      onDone();
    },
  });

  return (
    <form
      onSubmit={handleSubmit((v) => save.mutate(v))}
      noValidate
      className="mb-6 space-y-4 rounded-lg border border-primary/40 bg-card p-5"
    >
      <h2 className="font-semibold">{animal ? `Editar ${animal.name}` : 'Novo animal'}</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="name" label="Nome" error={errors.name?.message}>
          <Input {...register('name')} />
        </Field>
        <Field id="species" label="Espécie">
          <Select {...register('species')}>
            {Object.entries(SPECIES).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="ageMonths" label="Idade (meses)" error={errors.ageMonths?.message}>
          <Input type="number" min={0} {...register('ageMonths')} />
        </Field>
        <Field id="size" label="Porte">
          <Select {...register('size')}>
            {Object.entries(SIZES).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="sex" label="Sexo">
          <Select {...register('sex')}>
            {Object.entries(SEXES).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="status" label="Status">
          <Select {...register('status')}>
            {Object.entries(ANIMAL_STATUS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="flex gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" {...register('neutered')} /> Castrado(a)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" {...register('vaccinated')} /> Vacinado(a)
        </label>
      </div>
      <Field id="description" label="Descrição" error={errors.description?.message}>
        <Textarea rows={3} {...register('description')} />
      </Field>
      <Field
        id="photosText"
        label="Fotos (uma URL por linha)"
        hint="Use imagens livres, sem pessoas reais."
      >
        <Textarea rows={2} {...register('photosText')} />
      </Field>
      {save.error && <Alert tone="danger">{errorMessage(save.error)}</Alert>}
      <div className="flex gap-2">
        <Button type="submit" disabled={save.isPending}>
          Salvar
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export default function AdminAnimalsPage() {
  const { request } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<Animal | null | undefined>(undefined);
  const { data, error } = useQuery({
    queryKey: ['admin-animals', page, status],
    queryFn: () => request<Page<Animal>>(`/api/admin/animals${qs({ page, pageSize: 20, status })}`),
  });
  const remove = useMutation({
    mutationFn: (id: string) => request(`/api/admin/animals/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-animals'] }),
  });

  return (
    <>
      <AdminTitle title="Animais" description="Cadastro dos animais para adoção e apadrinhamento.">
        <Button onClick={() => setEditing(null)}>Novo animal</Button>
      </AdminTitle>
      {editing !== undefined && (
        <AnimalForm
          key={editing?.id ?? 'novo'}
          animal={editing}
          onDone={() => setEditing(undefined)}
        />
      )}
      <div className="mb-3 max-w-xs">
        <Field id="filtro-status" label="Status">
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            {Object.entries(ANIMAL_STATUS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {(error || remove.error) && (
        <Alert tone="danger" className="mb-3">
          {errorMessage(error ?? remove.error)}
        </Alert>
      )}
      <DataTable
        caption="Animais cadastrados"
        headers={['Nome', 'Espécie / porte', 'Idade', 'Status', 'Padrinhos', 'Ações']}
      >
        {data?.data.map((a) => (
          <tr key={a.id}>
            <Td className="font-medium">{a.name}</Td>
            <Td>
              {SPECIES[a.species]} · {SIZES[a.size]}
            </Td>
            <Td>{formatAge(a.ageMonths)}</Td>
            <Td>
              <StatusBadge kind="animal" value={a.status} />
            </Td>
            <Td>{a.activeSponsors ?? 0}</Td>
            <Td className="space-x-1 whitespace-nowrap">
              <Button size="sm" variant="outline" onClick={() => setEditing(a)}>
                Editar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => confirm(`Excluir ${a.name}?`) && remove.mutate(a.id)}
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
