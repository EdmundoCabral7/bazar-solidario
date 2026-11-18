'use client';

import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ApiError, errorMessage, post } from '@/lib/api';
import { PLANS } from '@/lib/labels';
import type { Animal, Sponsorship } from '@/lib/types';
import { cn, formatBRL, newIdempotencyKey } from '@/lib/utils';

const formSchema = z.object({
  plan: z.enum(['P20', 'P50', 'P100']),
  sponsorName: z.string().trim().min(2, 'Informe seu nome'),
  sponsorEmail: z.string().trim().email('Informe um e-mail válido'),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'É necessário aceitar para continuar' }),
  }),
});
type FormValues = z.infer<typeof formSchema>;

export function SponsorForm({ animal }: { animal: Animal }) {
  const key = useRef(newIdempotencyKey());
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { plan: 'P50' },
  });
  const plan = watch('plan');
  const create = useMutation({
    mutationFn: (v: FormValues) =>
      post<Sponsorship>(
        '/api/sponsorships',
        { animalSlug: animal.slug, ...v },
        { idempotencyKey: key.current },
      ),
    // o padrinho autoriza a cobrança recorrente no checkout do gateway (no modo demonstração, uma página simulada)
    onSuccess: (s) => {
      if (s.checkoutUrl) window.location.href = s.checkoutUrl;
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status < 500) key.current = newIdempotencyKey();
    },
  });

  return (
    <form onSubmit={handleSubmit((v) => create.mutate(v))} noValidate className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Escolha o plano mensal</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {Object.entries(PLANS).map(([value, p]) => (
            <label
              key={value}
              className={cn(
                'flex cursor-pointer flex-col rounded-md border p-4',
                plan === value ? 'border-primary bg-primary/5' : 'border-border',
              )}
            >
              <span className="flex items-center gap-2">
                <input type="radio" value={value} {...register('plan')} />
                <strong>{p.label}</strong>
              </span>
              <span className="mt-1 text-xl font-bold">
                {formatBRL(p.cents)}
                <span className="text-sm font-normal">/mês</span>
              </span>
              <span className="text-sm text-muted-foreground">{p.text}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="sponsorName" label="Seu nome" error={errors.sponsorName?.message}>
          <Input autoComplete="name" {...register('sponsorName')} />
        </Field>
        <Field
          id="sponsorEmail"
          label="E-mail"
          error={errors.sponsorEmail?.message}
          hint="Para recibos e para cancelar quando quiser."
        >
          <Input type="email" autoComplete="email" {...register('sponsorEmail')} />
        </Field>
      </div>
      <div className="space-y-1">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            aria-invalid={!!errors.consent}
            aria-describedby="consent-erro"
            {...register('consent')}
          />
          <span>
            Autorizo o uso do meu nome e e-mail para gerenciar o apadrinhamento e enviar notícias de{' '}
            {animal.name} (LGPD).
          </span>
        </label>
        {errors.consent && (
          <p id="consent-erro" className="text-sm text-destructive">
            {errors.consent.message}
          </p>
        )}
      </div>
      {create.error && <Alert tone="danger">{errorMessage(create.error)}</Alert>}
      <Button type="submit" size="lg" disabled={create.isPending || create.isSuccess}>
        {create.isPending || create.isSuccess
          ? 'Abrindo o pagamento…'
          : `Apadrinhar por ${formatBRL(PLANS[plan]!.cents)}/mês`}
      </Button>
      <p className="text-xs text-muted-foreground">
        Você será levado ao Mercado Pago para autorizar a cobrança mensal no cartão.
      </p>
    </form>
  );
}
