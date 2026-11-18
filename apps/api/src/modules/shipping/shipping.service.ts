import type { ShippingPackage } from '../../integrations/types';
import { integrations } from '../../integrations/registry';
import { AppError } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { ExternalServiceError } from '../../lib/resilience';

export interface CartItem {
  productId: string;
  quantity: number;
}

/** Endereço pelo CEP (ViaCEP). */
export async function lookupCep(cep: string) {
  try {
    const address = await integrations().cep.lookup(cep);
    if (!address) throw new AppError(404, 'CEP_NOT_FOUND', 'CEP não encontrado');
    return address;
  } catch (err) {
    if (err instanceof ExternalServiceError) {
      throw new AppError(
        503,
        'CEP_SERVICE_UNAVAILABLE',
        'Consulta de CEP indisponível. Preencha o endereço manualmente.',
      );
    }
    throw err;
  }
}

/** Carrega produtos do carrinho e valida disponibilidade/estoque. */
export async function loadCart(items: CartItem[]) {
  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
  });
  return items.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    if (!product || product.status !== 'ACTIVE') {
      throw new AppError(
        409,
        'PRODUCT_UNAVAILABLE',
        `Produto indisponível: ${product?.title ?? item.productId}`,
      );
    }
    if (product.stock < item.quantity) {
      throw new AppError(
        409,
        'OUT_OF_STOCK',
        `Estoque insuficiente para "${product.title}" (disponível: ${product.stock})`,
      );
    }
    return { product, quantity: item.quantity };
  });
}

/** Pacote simplificado: soma dos pesos, caixa padrão que cresce com a quantidade de peças. */
export function buildPackage(
  cart: { product: { weightGrams: number }; quantity: number }[],
): ShippingPackage {
  const weightGrams = cart.reduce((s, i) => s + i.product.weightGrams * i.quantity, 0);
  const pieces = cart.reduce((s, i) => s + i.quantity, 0);
  return { weightGrams, heightCm: Math.min(10 + (pieces - 1) * 4, 60), widthCm: 25, lengthCm: 35 };
}

export async function quoteShipping(cep: string, items: CartItem[]) {
  const cart = await loadCart(items);
  const pkg = buildPackage(cart);
  try {
    const quotes = await integrations().shipping.quote({ toCep: cep, pkg });
    if (quotes.length === 0)
      throw new AppError(422, 'SHIPPING_UNAVAILABLE', 'Não há opções de entrega para este CEP');
    return { cep, package: pkg, options: quotes.sort((a, b) => a.priceCents - b.priceCents) };
  } catch (err) {
    if (err instanceof ExternalServiceError) {
      throw new AppError(
        503,
        'SHIPPING_SERVICE_UNAVAILABLE',
        'Cálculo de frete indisponível no momento. Tente novamente ou escolha retirada.',
      );
    }
    throw err;
  }
}
