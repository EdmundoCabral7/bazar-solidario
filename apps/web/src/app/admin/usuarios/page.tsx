'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminTitle } from '@/components/admin/admin-shell';
import { DataTable, Td } from '@/components/admin/data-table';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ROLES } from '@/lib/labels';
import type { AuthUser } from '@/lib/types';

interface UserRow extends AuthUser {
  active: boolean;
  createdAt: string;
}

export default function UsersPage() {
  const { request, user: me } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'VOLUNTEER' });
  const { data, error } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => request<UserRow[]>('/api/admin/users'),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-users'] });
  const create = useMutation({
    mutationFn: () => request('/api/admin/users', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      refresh();
      setForm({ name: '', email: '', password: '', role: 'VOLUNTEER' });
    },
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<UserRow> }) =>
      request(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: refresh,
  });
  const err = error ?? create.error ?? update.error;

  return (
    <>
      <AdminTitle
        title="Usuários"
        description="S06 — Gestão de acessos. Desative o acesso de quem deixou a equipe em vez de excluir."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        className="mb-6 grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_160px_220px_auto] lg:items-end"
      >
        <Field id="u-name" label="Nome">
          <Input
            required
            minLength={2}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field id="u-email" label="E-mail">
          <Input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field id="u-pass" label="Senha inicial">
          <Input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        <Field id="u-role" label="Papel">
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {Object.entries(ROLES).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" disabled={create.isPending}>
          Criar
        </Button>
      </form>
      {err && (
        <Alert tone="danger" className="mb-3">
          {errorMessage(err)}
        </Alert>
      )}
      <DataTable caption="Usuários" headers={['Nome', 'E-mail', 'Papel', 'Status', '']}>
        {data?.map((u) => (
          <tr key={u.id}>
            <Td className="font-medium">
              {u.name}
              {u.id === me?.id && <span className="text-xs text-muted-foreground"> (você)</span>}
            </Td>
            <Td>{u.email}</Td>
            <Td>
              <Select
                aria-label={`Papel de ${u.name}`}
                value={u.role}
                disabled={u.id === me?.id}
                onChange={(e) =>
                  update.mutate({ id: u.id, body: { role: e.target.value as UserRow['role'] } })
                }
                className="h-9"
              >
                {Object.entries(ROLES).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Td>
            <Td>{u.active ? <Badge tone="success">Ativo</Badge> : <Badge>Inativo</Badge>}</Td>
            <Td>
              {u.id !== me?.id && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => update.mutate({ id: u.id, body: { active: !u.active } })}
                >
                  {u.active ? 'Desativar' : 'Reativar'}
                </Button>
              )}
            </Td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
