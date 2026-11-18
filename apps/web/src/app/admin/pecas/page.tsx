'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { productInputSchema } from '@bazar/shared';
import { AdminTitle } from '@/components/admin/admin-shell';
import { DataTable, Td } from '@/components/admin/data-table';
import { Pager } from '@/components/admin/pager';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage, qs } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CONDITIONS, PRODUCT_STATUS } from '@/lib/labels';
import type { Page, Product } from '@/lib/types';
import { formatBRL } from '@/lib/utils';

const formSchema = productInputSchema.omit({ photos: true, priceCents: true }).extend({
  price: z.coerce.number().min(1, 'Preço mínimo de R$ 1,00'),
  stock: z.coerce.number().int().min(0),
  weightGrams: z.coerce.number().int().min(50).max(30000),
  photosText: z.string().optional(),
});
type FormValues = z.input<typeof formSchema>;

function ProductForm({ product, onDone }: { product: Product | null; onDone: () => void }) {
  const { request } = useAuth();
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: product
      ? {
          ...product,
          size: product.size ?? '',
          price: product.priceCents / 100,
          photosText: product.photos.join('\n'),
        }
      : { condition: 'GOOD', status: 'ACTIVE', stock: 1, weightGrams: 500, category: 'Roupas' },
  });
  const save = useMutation({
    mutationFn: (v: FormValues) => {
      const { photosText, price, size, ...rest } = formSchema.parse(v);
      const body = {
        ...rest,
        size: size || null,
        priceCents: Math.round(price * 100),
        photos: (photosText ?? '')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      };
      return product
        ? request(`/api/admin/products/${product.id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          })
        : request('/api/admin/products', { method: 'POST', body: JSON.stringify(body) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      onDone();
    },
  });

  return (
    <form
      onSubmit={handleSubmit((v) => save.mutate(v))}
      noValidate
      className="mb-6 space-y-4 rounded-lg border border-primary/40 bg-card p-5"
    >
      <h2 className="font-semibold">{product ? `Editar ${product.title}` : 'Nova peça'}</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="title" label="Título" error={errors.title?.message} className="sm:col-span-2">
          <Input {...register('title')} />
        </Field>
        <Field id="category" label="Categoria" error={errors.category?.message}>
          <Input list="categorias" {...register('category')} />
        </Field>
        <Field id="price" label="Preço (R$)" error={errors.price?.message}>
          <Input type="number" step="0.01" min={1} {...register('price')} />
        </Field>
        <Field id="size" label="Tamanho (opcional)">
          <Input {...register('size')} />
        </Field>
        <Field id="condition" label="Estado">
          <Select {...register('condition')}>
            {Object.entries(CONDITIONS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="stock" label="Estoque" error={errors.stock?.message}>
          <Input type="number" min={0} {...register('stock')} />
        </Field>
        <Field
          id="weightGrams"
          label="Peso (g)"
          hint="Usado no cálculo do frete"
          error={errors.weightGrams?.message}
        >
          <Input type="number" min={50} {...register('weightGrams')} />
        </Field>
        <Field id="status" label="Status">
          <Select {...register('status')}>
            {Object.entries(PRODUCT_STATUS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <datalist id="categorias">
        {['Roupas', 'Calçados', 'Livros', 'Acessórios', 'Casa', 'Brinquedos'].map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <Field id="description" label="Descrição" error={errors.description?.message}>
        <Textarea rows={3} {...register('description')} />
      </Field>
      <Field id="photosText" label="Fotos (uma URL por linha)">
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

export default function AdminProductsPage() {
  const { request } = useAuth();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Product | null | undefined>(undefined);
  const { data, error } = useQuery({
    queryKey: ['admin-products', page, q],
    queryFn: () => request<Page<Product>>(`/api/admin/products${qs({ page, pageSize: 20, q })}`),
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      request<{ hidden: boolean }>(`/api/admin/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-products'] }),
  });

  return (
    <>
      <AdminTitle
        title="Peças do bazar"
        description="Peças com pedidos não são excluídas: ficam ocultas para preservar o histórico."
      >
        <Button onClick={() => setEditing(null)}>Nova peça</Button>
      </AdminTitle>
      {editing !== undefined && (
        <ProductForm
          key={editing?.id ?? 'nova'}
          product={editing}
          onDone={() => setEditing(undefined)}
        />
      )}
      <div className="mb-3 max-w-xs">
        <Field id="busca" label="Buscar">
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </Field>
      </div>
      {(error || remove.error) && (
        <Alert tone="danger" className="mb-3">
          {errorMessage(error ?? remove.error)}
        </Alert>
      )}
      {remove.data?.hidden && (
        <Alert tone="info" className="mb-3">
          A peça tinha pedidos e foi ocultada em vez de excluída.
        </Alert>
      )}
      <DataTable
        caption="Peças do bazar"
        headers={['Peça', 'Categoria', 'Preço', 'Estoque', 'Status', 'Ações']}
      >
        {data?.data.map((p) => (
          <tr key={p.id}>
            <Td className="font-medium">
              {p.title}
              {p.size ? ` (${p.size})` : ''}
            </Td>
            <Td>{p.category}</Td>
            <Td className="tabular-nums">{formatBRL(p.priceCents)}</Td>
            <Td>{p.stock}</Td>
            <Td>
              <Badge tone={p.status === 'ACTIVE' ? 'success' : 'neutral'}>
                {PRODUCT_STATUS[p.status]}
              </Badge>
            </Td>
            <Td className="space-x-1 whitespace-nowrap">
              <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                Editar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => confirm(`Excluir "${p.title}"?`) && remove.mutate(p.id)}
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
