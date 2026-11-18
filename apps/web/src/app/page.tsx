import Link from 'next/link';
import { HandHeart, Heart, ShoppingBag } from 'lucide-react';
import { AnimalCard } from '@/components/animal-card';
import { ProductCard } from '@/components/product-card';
import { Button } from '@/components/ui/button';
import { serverGet } from '@/lib/api';
import type { Animal, Campaign, Page, Product, Transparency } from '@/lib/types';
import { formatBRL } from '@/lib/utils';

export const revalidate = 60;

const ctas = [
  {
    href: '/doe',
    label: 'Quero doar',
    icon: HandHeart,
    text: 'Pix ou cartão, avulso ou apadrinhando um animal todo mês.',
  },
  {
    href: '/adote',
    label: 'Quero adotar',
    icon: Heart,
    text: 'Conheça cães e gatos esperando um lar em Natal.',
  },
  {
    href: '/bazar',
    label: 'Comprar no bazar',
    icon: ShoppingBag,
    text: 'Peças doadas; toda a renda vai para os animais.',
  },
];

export default async function HomePage() {
  const [animals, products, transparency, campaigns] = await Promise.all([
    serverGet<Page<Animal>>('/api/animals?pageSize=3&status=AVAILABLE'),
    serverGet<Page<Product>>('/api/products?pageSize=4'),
    serverGet<Transparency>('/api/transparency?months=12'),
    serverGet<Campaign[]>('/api/campaigns'),
  ]);
  const campaign = campaigns?.[0];

  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="py-12 sm:py-16">
        <p className="mb-3 inline-block rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
          Entidade simulada para fins acadêmicos
        </p>
        <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
          Cada compra, doação ou adoção muda a vida de um animal.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          A Associação Patas Potiguares resgata e cuida de cães e gatos em Natal/RN. Nosso bazar, as
          doações e as adoções agora estão online — com prestação de contas aberta para todo mundo.
        </p>
      </section>

      <section aria-label="Como ajudar" className="grid gap-4 sm:grid-cols-3">
        {ctas.map(({ href, label, icon: Icon, text }) => (
          <div key={href} className="flex flex-col rounded-lg border border-border bg-card p-5">
            <Icon aria-hidden className="mb-3 size-7 text-primary" />
            <p className="mb-4 flex-1 text-sm text-muted-foreground">{text}</p>
            <Button asChild>
              <Link href={href}>{label}</Link>
            </Button>
          </div>
        ))}
      </section>

      {transparency && (
        <section aria-labelledby="impacto" className="mt-12 rounded-lg bg-secondary p-6">
          <h2 id="impacto" className="text-xl font-semibold">
            Nosso impacto nos últimos 12 meses
          </h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ['Arrecadado', formatBRL(transparency.totals.raisedCents)],
              ['Investido nos animais', formatBRL(transparency.totals.spentCents)],
              ['Padrinhos ativos', String(transparency.impact.activeSponsorships)],
              ['Esperando um lar', String(transparency.impact.availableAnimals)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm text-secondary-foreground/80">{label}</dt>
                <dd className="text-2xl font-bold">{value}</dd>
              </div>
            ))}
          </dl>
          <Link
            href="/transparencia"
            className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Ver prestação de contas completa →
          </Link>
        </section>
      )}

      {campaign && (
        <section
          aria-labelledby="campanha"
          className="mt-12 rounded-lg border border-border bg-card p-6"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-primary">Campanha ativa</p>
          <h2 id="campanha" className="mt-1 text-xl font-semibold">
            {campaign.title}
          </h2>
          <p className="mt-1 text-muted-foreground">{campaign.description}</p>
          <div
            className="mt-4 h-3 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={campaign.progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso da campanha"
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max(campaign.progressPct, 2)}%` }}
            />
          </div>
          <p className="mt-2 text-sm">
            <strong>{formatBRL(campaign.raisedCents)}</strong> de {formatBRL(campaign.goalCents)} (
            {campaign.progressPct}%)
          </p>
          <Button asChild className="mt-4">
            <Link href={`/doe?campanha=${campaign.slug}`}>Doar para a campanha</Link>
          </Button>
        </section>
      )}

      {animals && animals.data.length > 0 && (
        <section aria-labelledby="destaques-animais" className="mt-12">
          <div className="mb-4 flex items-end justify-between">
            <h2 id="destaques-animais" className="text-xl font-semibold">
              Esperando por você
            </h2>
            <Link href="/adote" className="text-sm font-medium text-primary hover:underline">
              Ver todos
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {animals.data.map((a) => (
              <AnimalCard key={a.id} animal={a} />
            ))}
          </div>
        </section>
      )}

      {products && products.data.length > 0 && (
        <section aria-labelledby="destaques-bazar" className="mt-12">
          <div className="mb-4 flex items-end justify-between">
            <h2 id="destaques-bazar" className="text-xl font-semibold">
              Novidades no bazar
            </h2>
            <Link href="/bazar" className="text-sm font-medium text-primary hover:underline">
              Ver todas
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {products.data.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {!animals && !products && (
        <p
          role="status"
          className="mt-12 rounded-md border border-dashed border-border p-6 text-center text-muted-foreground"
        >
          Não conseguimos carregar os destaques agora. Tente novamente em instantes.
        </p>
      )}
    </div>
  );
}
