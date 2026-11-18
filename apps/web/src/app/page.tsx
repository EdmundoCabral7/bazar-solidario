import Link from 'next/link';
import { HandHeart, Heart, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiStatus } from './api-status';

const ctas = [
  {
    href: '/doe',
    label: 'Quero doar',
    icon: HandHeart,
    text: 'Pix ou cartão, avulso ou apadrinhando um animal.',
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
    text: 'Peças doadas; toda renda vai para os animais.',
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="py-12 sm:py-20">
        <p className="mb-3 inline-block rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
          Entidade simulada para fins acadêmicos
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
          Cada compra, doação ou adoção muda a vida de um animal.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          A Associação Patas Potiguares resgata e cuida de cães e gatos em Natal/RN. Agora o nosso
          bazar, as doações e as adoções estão online — com prestação de contas aberta.
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

      <section className="mt-10">
        <ApiStatus />
      </section>
    </div>
  );
}
