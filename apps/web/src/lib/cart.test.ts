import { describe, expect, it } from 'vitest';
import { cartCount, cartReducer, cartSubtotal, type CartItem } from './cart';
import { formatAge, maskCep, maskPhone } from './utils';

const item = {
  productId: 'p1',
  slug: 'camisa',
  title: 'Camisa',
  priceCents: 2500,
  photo: null,
  stock: 2,
};

describe('carrinho', () => {
  it('adiciona e soma quantidade respeitando o estoque', () => {
    let s: CartItem[] = cartReducer([], { type: 'add', item });
    s = cartReducer(s, { type: 'add', item });
    s = cartReducer(s, { type: 'add', item });
    expect(s[0]!.quantity).toBe(2);
    expect(cartCount(s)).toBe(2);
    expect(cartSubtotal(s)).toBe(5000);
  });

  it('quantidade zero remove o item', () => {
    const s = cartReducer([{ ...item, quantity: 1 }], {
      type: 'setQuantity',
      productId: 'p1',
      quantity: 0,
    });
    expect(s).toEqual([]);
  });

  it('limpa o carrinho', () => {
    expect(cartReducer([{ ...item, quantity: 1 }], { type: 'clear' })).toEqual([]);
  });
});

describe('formatação', () => {
  it('máscaras de CEP e telefone', () => {
    expect(maskCep('59015000')).toBe('59015-000');
    expect(maskPhone('84999991234')).toBe('(84) 99999-1234');
    expect(maskPhone('8432221234')).toBe('(84) 3222-1234');
  });
  it('idade em meses/anos', () => {
    expect(formatAge(1)).toBe('1 mês');
    expect(formatAge(8)).toBe('8 meses');
    expect(formatAge(24)).toBe('2 anos');
  });
});
