'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { loginSchema, type LoginInput } from '@bazar/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { errorMessage, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { AuthUser } from '@/lib/types';

export function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get('next') ?? '/admin';
  const { user, login } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    if (user) router.replace(next.startsWith('/admin') ? next : '/admin');
  }, [user, next, router]);

  const mutation = useMutation({
    mutationFn: (data: LoginInput) =>
      post<{ token: string; user: AuthUser }>('/api/auth/login', data),
    onSuccess: (res) => login(res.token, res.user),
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} noValidate className="space-y-4">
      <Field id="email" label="E-mail" error={errors.email?.message}>
        <Input type="email" autoComplete="email" {...register('email')} />
      </Field>
      <Field id="password" label="Senha" error={errors.password?.message}>
        <Input type="password" autoComplete="current-password" {...register('password')} />
      </Field>
      {mutation.error && <Alert tone="danger">{errorMessage(mutation.error)}</Alert>}
      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending ? 'Entrando…' : 'Entrar'}
      </Button>
      <p className="text-xs text-muted-foreground">
        Demonstração: admin@pataspotiguares.org / admin123
      </p>
    </form>
  );
}
