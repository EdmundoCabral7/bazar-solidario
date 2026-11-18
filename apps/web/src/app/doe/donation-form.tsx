'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { apiFetch, ApiError, errorMessage, post } from '@/lib/api';
import { useDemoMode } from '@/lib/demo';
import type { Campaign, Donation } from '@/lib/types';
import { cn, formatBRL, newIdempotencyKey } from '@/lib/utils';

const PRESETS = [2000, 5000, 10000, 20000];

const formSchema = z
  .object({
    amount: z.coerce
      .number({ invalid_type_error: 'Informe o valor' })
      .min(5, 'Doação mínima de R$ 5,00')
      .max(10000, 'Para valores acima de R$ 10.000 fale com a tesouraria'),
    campaignSlug: z.string().optional(),
    anonymous: z.boolean(),
    donorName: z.string().trim().optional(),
    donorEmail: z.union([z.literal(''), z.string().trim().email('E-mail inválido')]).optional(),
    method: z.enum(['PIX', 'CARD']),
    cardOutcome: z.enum(['approved', 'rejected']),
    consent: z.boolean(),
  })
  .refine((v) => !v.donorEmail || v.consent, {
    path: ['consent'],
    message: 'Aceite o uso do e-mail para receber o recibo',
  })
  .refine((v) => v.method !== 'CARD' || !!v.donorEmail, {
    path: ['donorEmail'],
    message: 'Informe o e-mail para pagar com cartão',
  });
type FormValues = z.infer<typeof formSchema>;

export function DonationForm() {
  const router = useRouter();
  const params = useSearchParams();
  const demo = useDemoMode();
  const key = useRef(newIdempotencyKey());
  const { data: campaigns } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => apiFetch<Campaign[]>('/api/campaigns'),
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 50,
      anonymous: false,
      method: 'PIX',
      cardOutcome: 'approved',
      consent: false,
      campaignSlug: params.get('campanha') ?? '',
    },
  });
  const amount = Number(watch('amount')) || 0;
  const anonymous = watch('anonymous');
  const method = watch('method');

  const donate = useMutation({
    mutationFn: (v: FormValues) =>
      post<Donation>(
        '/api/donations',
        {
          amountCents: Math.round(v.amount * 100),
          anonymous: v.anonymous,
          donorName: v.anonymous ? undefined : v.donorName || undefined,
          donorEmail: v.donorEmail || undefined,
          campaignSlug: v.campaignSlug || undefined,
          consent: v.consent,
          payment:
            v.method === 'PIX'
              ? { method: 'PIX' }
              : {
                  method: 'CARD',
                  cardToken:
                    v.cardOutcome === 'rejected' ? 'mock-card-rejected' : 'mock-card-approved',
                  paymentMethodId: 'visa',
                  installments: 1,
                },
        },
        { idempotencyKey: key.current },
      ),
    onSuccess: (d) => router.push(`/doe/obrigado?id=${d.id}`),
    onError: (err) => {
      if (err instanceof ApiError && err.status < 500) key.current = newIdempotencyKey();
    },
  });

  return (
    <form onSubmit={handleSubmit((v) => donate.mutate(v))} noValidate className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Valor</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={amount * 100 === c}
              onClick={() => setValue('amount', c / 100, { shouldValidate: true })}
              className={cn(
                'rounded-md border px-3 py-3 font-semibold',
                amount * 100 === c
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted',
              )}
            >
              {formatBRL(c)}
            </button>
          ))}
        </div>
        <Field
          id="amount"
          label="Outro valor (R$)"
          error={errors.amount?.message}
          className="mt-3 max-w-48"
        >
          <Input type="number" min={5} step="0.01" inputMode="decimal" {...register('amount')} />
        </Field>
      </fieldset>

      {campaigns && campaigns.length > 0 && (
        <Field id="campaignSlug" label="Destinar a uma campanha (opcional)">
          <Select {...register('campaignSlug')}>
            <option value="">Onde for mais necessário</option>
            {campaigns.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.title} — {c.progressPct}% da meta
              </option>
            ))}
          </Select>
        </Field>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register('anonymous')} /> Quero doar anonimamente
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        {!anonymous && (
          <Field id="donorName" label="Seu nome (opcional)">
            <Input autoComplete="name" {...register('donorName')} />
          </Field>
        )}
        <Field
          id="donorEmail"
          label="E-mail para recibo (opcional)"
          error={errors.donorEmail?.message}
        >
          <Input type="email" autoComplete="email" {...register('donorEmail')} />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Forma de pagamento</legend>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2">
            <input type="radio" value="PIX" {...register('method')} /> Pix
          </label>
          <label className={cn('flex items-center gap-2', !demo && 'opacity-60')}>
            <input type="radio" value="CARD" disabled={!demo} {...register('method')} /> Cartão{' '}
            {demo ? '(teste)' : '(em breve)'}
          </label>
        </div>
        {method === 'CARD' && demo && (
          <div className="mt-2 flex flex-wrap gap-4 rounded-md border border-dashed border-border p-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" value="approved" {...register('cardOutcome')} /> Cartão de teste
              aprovado
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" value="rejected" {...register('cardOutcome')} /> Cartão de teste
              recusado
            </label>
          </div>
        )}
      </fieldset>

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
            Autorizo o uso do meu nome e e-mail apenas para registrar a doação e enviar o recibo
            (LGPD).
          </span>
        </label>
        {errors.consent && (
          <p id="consent-erro" className="text-sm text-destructive">
            {errors.consent.message}
          </p>
        )}
      </div>

      {donate.error && <Alert tone="danger">{errorMessage(donate.error)}</Alert>}
      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={donate.isPending}>
        {donate.isPending
          ? 'Processando…'
          : `Doar ${amount >= 5 ? formatBRL(Math.round(amount * 100)) : ''}`}
      </Button>
    </form>
  );
}
