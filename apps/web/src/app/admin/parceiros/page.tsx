'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminTitle } from '@/components/admin/admin-shell';
import { DataTable, Td } from '@/components/admin/data-table';
import { CopyButton } from '@/components/copy-button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime } from '@/lib/utils';

interface Partner {
  id: string;
  name: string;
  contactEmail: string;
  apiKeyPrefix: string;
  active: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export default function PartnersPage() {
  const { request } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', contactEmail: '' });
  const [newKey, setNewKey] = useState<{ name: string; key: string } | null>(null);
  const { data, error } = useQuery({
    queryKey: ['admin-partners'],
    queryFn: () => request<Partner[]>('/api/admin/partners'),
  });
  const onKey = (p: Partner & { apiKey: string }) => {
    setNewKey({ name: p.name, key: p.apiKey });
    qc.invalidateQueries({ queryKey: ['admin-partners'] });
  };
  const create = useMutation({
    mutationFn: () =>
      request<Partner & { apiKey: string }>('/api/admin/partners', {
        method: 'POST',
        body: JSON.stringify(form),
      }),
    onSuccess: (p) => {
      onKey(p);
      setForm({ name: '', contactEmail: '' });
    },
  });
  const rotate = useMutation({
    mutationFn: (id: string) =>
      request<Partner & { apiKey: string }>(`/api/admin/partners/${id}/rotate-key`, {
        method: 'POST',
      }),
    onSuccess: onKey,
  });
  const revoke = useMutation({
    mutationFn: (id: string) => request(`/api/admin/partners/${id}/revoke`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-partners'] }),
  });
  const err = error ?? create.error ?? rotate.error ?? revoke.error;

  return (
    <>
      <AdminTitle
        title="Parceiros da API pública"
        description="Pet shops e clínicas consultam animais e campanhas em /api/public/v1 com a chave x-api-key (60 req/min)."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        className="mb-6 grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <Field id="p-name" label="Nome do parceiro">
          <Input
            required
            minLength={2}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field id="p-email" label="E-mail de contato">
          <Input
            type="email"
            required
            value={form.contactEmail}
            onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
          />
        </Field>
        <Button type="submit" disabled={create.isPending}>
          Cadastrar e gerar chave
        </Button>
      </form>
      {newKey && (
        <Alert
          tone="warning"
          title={`Chave de ${newKey.name} — copie agora, ela não será exibida de novo`}
          className="mb-4"
        >
          <code className="my-2 block break-all rounded bg-muted p-2 font-mono text-xs">
            {newKey.key}
          </code>
          <div className="flex gap-2">
            <CopyButton text={newKey.key} label="Copiar chave" />
            <Button variant="ghost" onClick={() => setNewKey(null)}>
              Já copiei
            </Button>
          </div>
        </Alert>
      )}
      {err && (
        <Alert tone="danger" className="mb-3">
          {errorMessage(err)}
        </Alert>
      )}
      <DataTable
        caption="Parceiros"
        headers={['Parceiro', 'Chave', 'Último uso', 'Status', 'Ações']}
      >
        {data?.map((p) => (
          <tr key={p.id}>
            <Td>
              {p.name}
              <span className="block text-xs text-muted-foreground">{p.contactEmail}</span>
            </Td>
            <Td className="font-mono text-xs">{p.apiKeyPrefix}…</Td>
            <Td>{p.lastUsedAt ? formatDateTime(p.lastUsedAt) : 'Nunca'}</Td>
            <Td>
              {p.active ? (
                <Badge tone="success">Ativa</Badge>
              ) : (
                <Badge tone="danger">Revogada</Badge>
              )}
            </Td>
            <Td className="space-x-1 whitespace-nowrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  confirm('Gerar nova chave? A atual para de funcionar na hora.') &&
                  rotate.mutate(p.id)
                }
              >
                Nova chave
              </Button>
              {p.active && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => confirm(`Revogar acesso de ${p.name}?`) && revoke.mutate(p.id)}
                >
                  Revogar
                </Button>
              )}
            </Td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
