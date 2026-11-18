'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { phoneSchema } from '@bazar/shared';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { apiFetch, ApiError, errorMessage, post } from '@/lib/api';
import { useCart } from '@/lib/cart-context';
import { useDemoMode } from '@/lib/demo';
import type { Address, Order, ShippingOption } from '@/lib/types';
import { cn, formatBRL, maskCep, maskPhone, newIdempotencyKey } from '@/lib/utils';

const formSchema = z
  .object({
    name: z.string().trim().min(2, 'Informe seu nome'),
    email: z.string().trim().email('Informe um e-mail válido'),
    phone: phoneSchema,
    deliveryType: z.enum(['PICKUP', 'SHIPPING']),
    cep: z.string().optional(),
    street: z.string().optional(),
    number: z.string().optional(),
    complement: z.string().optional(),
    district: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    shippingService: z.string().optional(),
    method: z.enum(['PIX', 'CARD']),
    cardOutcome: z.enum(['approved', 'rejected']).optional(),
    consent: z.literal(true, {
      errorMap: () => ({ message: 'É necessário aceitar para continuar' }),
    }),
  })
  .superRefine((v, ctx) => {
    if (v.deliveryType !== 'SHIPPING') return;
    const req = (
      key: keyof typeof v,
      msg: string,
      ok = !!(v[key] as string | undefined)?.trim(),
    ) => {
      if (!ok) ctx.addIssue({ code: 'custom', path: [key], message: msg });
    };
    req('cep', 'CEP inválido', /^\d{5}-?\d{3}$/.test(v.cep ?? ''));
    req('street', 'Informe a rua');
    req('number', 'Informe o número');
    req('district', 'Informe o bairro');
    req('city', 'Informe a cidade');
    req('state', 'UF com 2 letras', /^[A-Za-z]{2}$/.test(v.state ?? ''));
    req('shippingService', 'Escolha uma opção de frete');
  });
type FormValues = z.infer<typeof formSchema>;

export default function CheckoutPage() {
  const router = useRouter();
  const demo = useDemoMode();
  const { items, subtotalCents, dispatch } = useCart();
  const idempotencyKey = useRef(newIdempotencyKey());
  const [options, setOptions] = useState<ShippingOption[] | null>(null);
  const [cepStatus, setCepStatus] = useState<{ loading: boolean; error?: string }>({
    loading: false,
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { deliveryType: 'PICKUP', method: 'PIX', cardOutcome: 'approved' },
  });

  const deliveryType = watch('deliveryType');
  const method = watch('method');
  const cep = watch('cep') ?? '';
  const shippingService = watch('shippingService');
  const shippingCents =
    deliveryType === 'SHIPPING'
      ? (options?.find((o) => o.service === shippingService)?.priceCents ?? 0)
      : 0;

  // CEP completo → endereço (ViaCEP) + cotação de frete (Melhor Envio)
  useEffect(() => {
    const digits = cep.replace(/\D/g, '');
    if (deliveryType !== 'SHIPPING' || digits.length !== 8 || items.length === 0) return;
    let cancelled = false;
    setCepStatus({ loading: true });
    setOptions(null);
    setValue('shippingService', undefined);
    (async () => {
      try {
        const addr = await apiFetch<Address>(`/api/cep/${digits}`).catch((err) => {
          if (!cancelled) setCepStatus({ loading: true, error: errorMessage(err) });
          return null;
        });
        if (addr && !cancelled) {
          setValue('street', addr.street);
          setValue('district', addr.district);
          setValue('city', addr.city);
          setValue('state', addr.state);
        }
        const quote = await post<{ options: ShippingOption[] }>('/api/shipping/quote', {
          cep: digits,
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        });
        if (!cancelled) {
          setOptions(quote.options);
          if (quote.options[0]) setValue('shippingService', quote.options[0].service);
          setCepStatus((s) => ({ loading: false, error: s.error }));
        }
      } catch (err) {
        if (!cancelled) setCepStatus({ loading: false, error: errorMessage(err) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cep, deliveryType, items, setValue]);

  const order = useMutation({
    mutationFn: (v: FormValues) =>
      post<Order>(
        '/api/orders',
        {
          customer: { name: v.name, email: v.email, phone: v.phone },
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          delivery:
            v.deliveryType === 'PICKUP'
              ? { type: 'PICKUP' }
              : {
                  type: 'SHIPPING',
                  cep: v.cep,
                  street: v.street,
                  number: v.number,
                  complement: v.complement || undefined,
                  district: v.district,
                  city: v.city,
                  state: v.state,
                  shippingService: v.shippingService,
                },
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
          consent: true,
        },
        { idempotencyKey: idempotencyKey.current },
      ),
    onSuccess: (o) => {
      dispatch({ type: 'clear' });
      router.push(`/pedido/${o.code}`);
    },
    onError: (err) => {
      // erros de negócio (estoque) exigem nova tentativa com outra chave
      if (err instanceof ApiError && err.status < 500) idempotencyKey.current = newIdempotencyKey();
    },
  });

  if (items.length === 0 && !order.isSuccess) {
    return (
      <div className="mx-auto max-w-3xl px-4">
        <PageHeader title="Fechar pedido" />
        <EmptyState title="Seu carrinho está vazio">
          <Link href="/bazar" className="text-primary hover:underline">
            Voltar ao bazar
          </Link>
        </EmptyState>
      </div>
    );
  }

  const radioCard = (checked: boolean) =>
    cn(
      'flex cursor-pointer items-start gap-3 rounded-md border p-3',
      checked ? 'border-primary bg-primary/5' : 'border-border',
    );

  return (
    <div className="mx-auto max-w-5xl px-4">
      <PageHeader title="Fechar pedido" />
      <form
        onSubmit={handleSubmit((v) => order.mutate(v))}
        noValidate
        className="grid gap-8 lg:grid-cols-[1fr_320px]"
      >
        <div className="space-y-8">
          <fieldset className="space-y-4">
            <legend className="mb-2 text-lg font-semibold">1. Seus dados</legend>
            <Field id="name" label="Nome completo" error={errors.name?.message}>
              <Input autoComplete="name" {...register('name')} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="email" label="E-mail" error={errors.email?.message}>
                <Input type="email" autoComplete="email" {...register('email')} />
              </Field>
              <Field
                id="phone"
                label="WhatsApp"
                error={errors.phone?.message}
                hint="Avisamos cada etapa do pedido por aqui."
              >
                <Input
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  {...register('phone', {
                    onChange: (e) => (e.target.value = maskPhone(e.target.value)),
                  })}
                />
              </Field>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="mb-2 text-lg font-semibold">2. Entrega</legend>
            <label className={radioCard(deliveryType === 'PICKUP')}>
              <input type="radio" value="PICKUP" className="mt-1" {...register('deliveryType')} />
              <span>
                <strong>Retirar na sede</strong> — grátis
                <span className="block text-sm text-muted-foreground">
                  Natal/RN, seg a sáb, 9h–17h (combinamos pelo WhatsApp).
                </span>
              </span>
            </label>
            <label className={radioCard(deliveryType === 'SHIPPING')}>
              <input type="radio" value="SHIPPING" className="mt-1" {...register('deliveryType')} />
              <span>
                <strong>Receber em casa</strong>
                <span className="block text-sm text-muted-foreground">
                  Correios, frete calculado pelo CEP.
                </span>
              </span>
            </label>

            {deliveryType === 'SHIPPING' && (
              <div className="space-y-4 rounded-md border border-border p-4">
                <Field
                  id="cep"
                  label="CEP"
                  error={errors.cep?.message}
                  hint={cepStatus.loading ? 'Buscando endereço e frete…' : undefined}
                >
                  <Input
                    inputMode="numeric"
                    autoComplete="postal-code"
                    className="max-w-40"
                    {...register('cep', {
                      onChange: (e) => (e.target.value = maskCep(e.target.value)),
                    })}
                  />
                </Field>
                {cepStatus.error && <Alert tone="warning">{cepStatus.error}</Alert>}
                <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                  <Field id="street" label="Rua" error={errors.street?.message}>
                    <Input autoComplete="address-line1" {...register('street')} />
                  </Field>
                  <Field id="number" label="Número" error={errors.number?.message}>
                    <Input {...register('number')} />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="complement" label="Complemento (opcional)">
                    <Input autoComplete="address-line2" {...register('complement')} />
                  </Field>
                  <Field id="district" label="Bairro" error={errors.district?.message}>
                    <Input {...register('district')} />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-[1fr_100px]">
                  <Field id="city" label="Cidade" error={errors.city?.message}>
                    <Input autoComplete="address-level2" {...register('city')} />
                  </Field>
                  <Field id="state" label="UF" error={errors.state?.message}>
                    <Input maxLength={2} autoComplete="address-level1" {...register('state')} />
                  </Field>
                </div>
                {options && (
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium">Opção de frete</legend>
                    {options.map((o) => (
                      <label key={o.service} className={radioCard(shippingService === o.service)}>
                        <input
                          type="radio"
                          value={o.service}
                          className="mt-1"
                          {...register('shippingService')}
                        />
                        <span className="flex flex-1 justify-between gap-2">
                          <span>
                            {o.company} {o.service}
                            <span className="block text-sm text-muted-foreground">
                              até {o.deliveryDays} dias úteis
                            </span>
                          </span>
                          <strong>{formatBRL(o.priceCents)}</strong>
                        </span>
                      </label>
                    ))}
                    {errors.shippingService && (
                      <p className="text-sm text-destructive">{errors.shippingService.message}</p>
                    )}
                  </fieldset>
                )}
              </div>
            )}
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="mb-2 text-lg font-semibold">3. Pagamento</legend>
            <label className={radioCard(method === 'PIX')}>
              <input type="radio" value="PIX" className="mt-1" {...register('method')} />
              <span>
                <strong>Pix</strong>
                <span className="block text-sm text-muted-foreground">
                  QR Code na próxima tela; confirmação na hora.
                </span>
              </span>
            </label>
            <label
              className={cn(radioCard(method === 'CARD'), !demo && 'cursor-not-allowed opacity-60')}
            >
              <input
                type="radio"
                value="CARD"
                className="mt-1"
                disabled={!demo}
                {...register('method')}
              />
              <span>
                <strong>Cartão de crédito</strong>
                <span className="block text-sm text-muted-foreground">
                  {demo
                    ? 'Modo demonstração: escolha o resultado do cartão de teste.'
                    : 'Disponível em breve.'}
                </span>
              </span>
            </label>
            {method === 'CARD' && demo && (
              <div className="flex gap-4 rounded-md border border-dashed border-border p-3 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" value="approved" {...register('cardOutcome')} /> Cartão de
                  teste aprovado
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" value="rejected" {...register('cardOutcome')} /> Cartão de
                  teste recusado
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
                Autorizo o uso do meu nome, e-mail, telefone e endereço exclusivamente para
                processar e entregar este pedido, conforme a LGPD.
              </span>
            </label>
            {errors.consent && (
              <p id="consent-erro" className="text-sm text-destructive">
                {errors.consent.message}
              </p>
            )}
          </div>
        </div>

        <aside
          className="h-fit space-y-4 rounded-lg border border-border bg-card p-5 lg:sticky lg:top-20"
          aria-label="Resumo do pedido"
        >
          <h2 className="font-semibold">Resumo</h2>
          <ul className="space-y-2 text-sm">
            {items.map((i) => (
              <li key={i.productId} className="flex justify-between gap-2">
                <span>
                  {i.quantity}× {i.title}
                </span>
                <span>{formatBRL(i.priceCents * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <dl className="space-y-1 border-t border-border pt-3 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatBRL(subtotalCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Frete</dt>
              <dd>
                {deliveryType === 'PICKUP'
                  ? 'Grátis'
                  : shippingCents
                    ? formatBRL(shippingCents)
                    : '—'}
              </dd>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <dt>Total</dt>
              <dd>{formatBRL(subtotalCents + shippingCents)}</dd>
            </div>
          </dl>
          {order.error && <Alert tone="danger">{errorMessage(order.error)}</Alert>}
          <Button type="submit" size="lg" className="w-full" disabled={order.isPending}>
            {order.isPending ? 'Processando…' : method === 'PIX' ? 'Gerar Pix' : 'Pagar com cartão'}
          </Button>
        </aside>
      </form>
    </div>
  );
}
