'use client';

import { createContext, useContext, useEffect, useReducer, useRef } from 'react';
import { cartCount, cartReducer, cartSubtotal, type CartAction, type CartItem } from './cart';

const STORAGE_KEY = 'bazar.cart.v1';

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotalCents: number;
  dispatch: (action: CartAction) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, dispatch] = useReducer(cartReducer, []);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: 'hydrate', items: JSON.parse(raw) as CartItem[] });
    } catch {
      /* armazenamento indisponível: carrinho só na memória */
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignora */
    }
  }, [items]);

  return (
    <CartContext.Provider
      value={{ items, count: cartCount(items), subtotalCents: cartSubtotal(items), dispatch }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart fora do CartProvider');
  return ctx;
}
