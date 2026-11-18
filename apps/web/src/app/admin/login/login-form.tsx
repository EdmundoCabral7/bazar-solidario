'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { loginSchema, type LoginInput } from '@bazar/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch, ApiError } from '@/lib/api';

interface LoginResponse {
  token: string;
  user: { name: string; role: string };
}

export function LoginForm() {
  const [welcome, setWelcome] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const login = useMutation({
    mutationFn: (data: LoginInput) =>
      apiFetch<LoginResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (res) => {
      // Fase 1: só armazena o token. O painel admin chega na Fase 3.
      sessionStorage.setItem('bazar.token', res.token);
      setWelcome(`Olá, ${res.user.name}! Login efetuado (${res.user.role}).`);
    },
  });

  return (
    <form onSubmit={handleSubmit((d) => login.mutate(d))} noValidate className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          aria-describedby="email-erro"
          {...register('email')}
        />
        {errors.email && (
          <p id="email-erro" className="text-sm text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          aria-describedby="senha-erro"
          {...register('password')}
        />
        {errors.password && (
          <p id="senha-erro" className="text-sm text-destructive">
            {errors.password.message}
          </p>
        )}
      </div>
      {login.error && (
        <p role="alert" className="text-sm text-destructive">
          {login.error instanceof ApiError ? login.error.message : 'Erro inesperado'}
        </p>
      )}
      {welcome && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {welcome}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={login.isPending}>
        {login.isPending ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  );
}
