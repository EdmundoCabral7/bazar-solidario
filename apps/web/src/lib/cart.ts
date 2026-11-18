/** Lógica pura do carrinho (testável). */
export interface CartItem {
  productId: string;
  slug: string;
  title: string;
  priceCents: number;
  photo: string | null;
  quantity: number;
  stock: number;
}

export type CartAction =
  | { type: 'add'; item: Omit<CartItem, 'quantity'>; quantity?: number }
  | { type: 'setQuantity'; productId: string; quantity: number }
  | { type: 'remove'; productId: string }
  | { type: 'clear' }
  | { type: 'hydrate'; items: CartItem[] };

export function cartReducer(state: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case 'add': {
      const qty = action.quantity ?? 1;
      const existing = state.find((i) => i.productId === action.item.productId);
      if (existing) {
        return state.map((i) =>
          i.productId === action.item.productId
            ? { ...i, ...action.item, quantity: Math.min(i.quantity + qty, action.item.stock) }
            : i,
        );
      }
      return [...state, { ...action.item, quantity: Math.min(qty, action.item.stock) }];
    }
    case 'setQuantity':
      return state
        .map((i) =>
          i.productId === action.productId
            ? { ...i, quantity: Math.max(0, Math.min(action.quantity, i.stock)) }
            : i,
        )
        .filter((i) => i.quantity > 0);
    case 'remove':
      return state.filter((i) => i.productId !== action.productId);
    case 'clear':
      return [];
    case 'hydrate':
      return action.items;
  }
}

export const cartCount = (items: CartItem[]) => items.reduce((s, i) => s + i.quantity, 0);
export const cartSubtotal = (items: CartItem[]) =>
  items.reduce((s, i) => s + i.priceCents * i.quantity, 0);
