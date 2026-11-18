'use client';

import Link from 'next/link';
import { useForm, type UseFormRegister } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { adoptionAnswersSchema, phoneSchema } from '@bazar/shared';
import { CopyButton } from '@/components/copy-button';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage, post } from '@/lib/api';
import type { Animal } from '@/lib/types';
import { maskPhone } from '@/lib/utils';

const yesNo = z.enum(['sim', 'nao'], { errorMap: () => ({ message: 'Escolha uma opção' }) });
const formSchema = z
  .object({
    applicantName: z.string().trim().min(2, 'Informe seu nome'),
    applicantEmail: z.string().trim().email('Informe um e-mail válido'),
    applicantPhone: phoneSchema,
    city: z.string().trim().min(2, 'Informe a cidade'),
    housingType: adoptionAnswersSchema.shape.housingType,
    ownsHome: yesNo,
    hasYard: yesNo,
    hasOtherPets: yesNo,
    otherPetsDescription: z.string().max(300).optional(),
    hasChildren: yesNo,
    hoursAlonePerDay: z.coerce
      .number({ invalid_type_error: 'Informe as horas' })
      .int()
      .min(0, 'Informe as horas')
      .max(24),
    allResidentsAgree: yesNo,
    canAffordCosts: yesNo,
    motivation: adoptionAnswersSchema.shape.motivation,
    consent: z.literal(true, { errorMap: () => ({ message: 'É necessário aceitar para enviar' }) }),
  })
  .superRefine((v, ctx) => {
    if (v.allResidentsAgree === 'nao') {
      ctx.addIssue({
        code: 'custom',
        path: ['allResidentsAgree'],
        message: 'Todos os moradores precisam concordar com a adoção',
      });
    }
  });
type FormValues = z.infer<typeof formSchema>;

function YesNo({
  id,
  label,
  error,
  register,
}: {
  id: keyof FormValues;
  label: string;
  error?: string;
  register: UseFormRegister<FormValues>;
}) {
  return (
    <fieldset className="space-y-1" aria-describedby={error ? `${id}-erro` : undefined}>
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex gap-4">
        <label className="flex items-center gap-2">
          <input type="radio" value="sim" {...register(id)} /> Sim
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" value="nao" {...register(id)} /> Não
        </label>
      </div>
      {error && (
        <p id={`${id}-erro`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function AdoptionForm({ animal }: { animal: Animal }) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });
  const submit = useMutation({
    mutationFn: (v: FormValues) =>
      post<{ code: string }>('/api/adoptions', {
        animalSlug: animal.slug,
        applicantName: v.applicantName,
        applicantEmail: v.applicantEmail,
        applicantPhone: v.applicantPhone,
        city: v.city,
        answers: {
          housingType: v.housingType,
          ownsHome: v.ownsHome === 'sim',
          hasYard: v.hasYard === 'sim',
          hasOtherPets: v.hasOtherPets === 'sim',
          otherPetsDescription: v.otherPetsDescription || undefined,
          hasChildren: v.hasChildren === 'sim',
          hoursAlonePerDay: v.hoursAlonePerDay,
          allResidentsAgree: true,
          canAffordCosts: v.canAffordCosts === 'sim',
          motivation: v.motivation,
        },
        consent: true,
      }),
  });

  if (submit.data) {
    return (
      <Alert tone="success" title="Solicitação enviada!">
        <p>
          Seu protocolo é <strong className="font-mono text-base">{submit.data.code}</strong>. A
          equipe vai analisar e entrar em contato pelo WhatsApp em até 3 dias úteis.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <CopyButton text={submit.data.code} label="Copiar protocolo" />
          <Button asChild variant="outline">
            <Link href={`/adote/acompanhar?codigo=${submit.data.code}`}>Acompanhar</Link>
          </Button>
        </div>
      </Alert>
    );
  }

  const e = errors;
  return (
    <form onSubmit={handleSubmit((v) => submit.mutate(v))} noValidate className="space-y-8 pb-8">
      <fieldset className="space-y-4">
        <legend className="mb-2 text-lg font-semibold">Seus dados</legend>
        <Field id="applicantName" label="Nome completo" error={e.applicantName?.message}>
          <Input autoComplete="name" {...register('applicantName')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="applicantEmail" label="E-mail" error={e.applicantEmail?.message}>
            <Input type="email" autoComplete="email" {...register('applicantEmail')} />
          </Field>
          <Field id="applicantPhone" label="WhatsApp" error={e.applicantPhone?.message}>
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              {...register('applicantPhone', {
                onChange: (ev) => (ev.target.value = maskPhone(ev.target.value)),
              })}
            />
          </Field>
        </div>
        <Field id="city" label="Cidade onde mora" error={e.city?.message}>
          <Input autoComplete="address-level2" {...register('city')} />
        </Field>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="mb-2 text-lg font-semibold">Sua casa e rotina</legend>
        <Field id="housingType" label="Tipo de moradia" error={e.housingType?.message}>
          <Select defaultValue="" {...register('housingType')}>
            <option value="" disabled>
              Selecione
            </option>
            <option value="HOUSE">Casa</option>
            <option value="APARTMENT">Apartamento</option>
            <option value="OTHER">Outro</option>
          </Select>
        </Field>
        <YesNo
          id="ownsHome"
          label="O imóvel é próprio?"
          error={e.ownsHome?.message}
          register={register}
        />
        <YesNo
          id="hasYard"
          label="Tem quintal ou área externa telada?"
          error={e.hasYard?.message}
          register={register}
        />
        <YesNo
          id="hasOtherPets"
          label="Já tem outros animais?"
          error={e.hasOtherPets?.message}
          register={register}
        />
        {watch('hasOtherPets') === 'sim' && (
          <Field id="otherPetsDescription" label="Quais? São castrados e vacinados?">
            <Input {...register('otherPetsDescription')} />
          </Field>
        )}
        <YesNo
          id="hasChildren"
          label="Moram crianças na casa?"
          error={e.hasChildren?.message}
          register={register}
        />
        <Field
          id="hoursAlonePerDay"
          label="Quantas horas por dia o animal ficaria sozinho?"
          error={e.hoursAlonePerDay?.message}
        >
          <Input
            type="number"
            min={0}
            max={24}
            inputMode="numeric"
            className="max-w-32"
            {...register('hoursAlonePerDay')}
          />
        </Field>
        <YesNo
          id="allResidentsAgree"
          label="Todos os moradores concordam com a adoção?"
          error={e.allResidentsAgree?.message}
          register={register}
        />
        <YesNo
          id="canAffordCosts"
          label="Você pode arcar com ração, vacinas anuais e veterinário?"
          error={e.canAffordCosts?.message}
          register={register}
        />
        <Field
          id="motivation"
          label={`Por que você quer adotar ${animal.name}?`}
          error={e.motivation?.message}
        >
          <Textarea rows={4} {...register('motivation')} />
        </Field>
      </fieldset>

      <div className="space-y-1">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            aria-invalid={!!e.consent}
            aria-describedby="consent-erro"
            {...register('consent')}
          />
          <span>
            Autorizo a Associação Patas Potiguares a usar meus dados apenas para avaliar esta adoção
            e entrar em contato, conforme a LGPD. Posso pedir a exclusão a qualquer momento pela
            Central de atendimento.
          </span>
        </label>
        {e.consent && (
          <p id="consent-erro" className="text-sm text-destructive">
            {e.consent.message}
          </p>
        )}
      </div>

      {submit.error && <Alert tone="danger">{errorMessage(submit.error)}</Alert>}
      <Button type="submit" size="lg" disabled={submit.isPending}>
        {submit.isPending ? 'Enviando…' : 'Enviar solicitação'}
      </Button>
    </form>
  );
}
