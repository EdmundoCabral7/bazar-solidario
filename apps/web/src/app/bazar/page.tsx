import type { Metadata } from 'next';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { ProductCard } from '@/components/product-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { qs, serverGet } from '@/lib/api';
import { CONDITIONS } from '@/lib/labels';
import type { Page, Product } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Bazar solidário',
  description: 'Roupas, calçados, livros e acessórios doados. Toda a renda vai para os animais.',
};

type Search = Promise<Record<string, string | undefined>>;

export default async function BazarPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const filters = {
    q: sp.q,
    category: sp.categoria,
    size: sp.tamanho,
    condition: sp.estado,
    maxPriceCents: sp.ate ? Number(sp.ate) * 100 : undefined,
    page: sp.pagina ?? '1',
    pageSize: 12,
  };
  const [products, categories] = await Promise.all([
    serverGet<Page<Product>>(`/api/products${qs(filters)}`, 15),
    serverGet<{ category: string; count: number }[]>('/api/products/categories', 60),
  ]);

  const hrefFor = (p: number) =>
    `/bazar${qs({ q: sp.q, categoria: sp.categoria, tamanho: sp.tamanho, estado: sp.estado, ate: sp.ate, pagina: p })}`;

  return (
    <div className="mx-auto max-w-6xl px-4">
      <PageHeader
        title="Bazar solidário"
        description="Peças doadas pela comunidade. Cada compra ajuda a pagar ração, vacinas e castrações."
      />

      <form
        method="get"
        className="mb-8 grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6"
        aria-label="Filtrar peças"
      >
        <div className="space-y-1 lg:col-span-2">
          <Label htmlFor="q">Buscar</Label>
          <Input id="q" name="q" defaultValue={sp.q} placeholder="Ex.: vestido, tênis" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="categoria">Categoria</Label>
          <Select id="categoria" name="categoria" defaultValue={sp.categoria ?? ''}>
            <option value="">Todas</option>
            {categories?.map((c) => (
              <option key={c.category} value={c.category}>
                {c.category} ({c.count})
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="tamanho">Tamanho</Label>
          <Input id="tamanho" name="tamanho" defaultValue={sp.tamanho} placeholder="P, M, 40..." />
        </div>
        <div className="space-y-1">
          <Label htmlFor="estado">Estado</Label>
          <Select id="estado" name="estado" defaultValue={sp.estado ?? ''}>
            <option value="">Qualquer</option>
            {Object.entries(CONDITIONS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ate">Até (R$)</Label>
          <Input
            id="ate"
            name="ate"
            type="number"
            min={1}
            inputMode="numeric"
            defaultValue={sp.ate}
          />
        </div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
          <Button type="submit">Filtrar</Button>
          <Button asChild variant="ghost">
            <a href="/bazar">Limpar</a>
          </Button>
        </div>
      </form>

      {!products ? (
        <EmptyState title="Não foi possível carregar o bazar agora">
          Tente novamente em instantes.
        </EmptyState>
      ) : products.data.length === 0 ? (
        <EmptyState title="Nenhuma peça encontrada">
          Tente outros filtros — chegam peças novas toda semana.
        </EmptyState>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground" role="status">
            {products.total} {products.total === 1 ? 'peça encontrada' : 'peças encontradas'}
          </p>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {products.data.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          <Pagination page={products.page} totalPages={products.totalPages} hrefFor={hrefFor} />
        </>
      )}
    </div>
  );
}
