import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { Dish } from '@/data/menu';

export type CartLine = { dish: Dish; quantity: number };

type CartContextValue = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  add: (dish: Dish, quantity?: number) => void;
  setQuantity: (dishId: string, quantity: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  const add = useCallback((dish: Dish, quantity = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.dish.id === dish.id);
      if (existing) {
        return prev.map((l) => (l.dish.id === dish.id ? { ...l, quantity: l.quantity + quantity } : l));
      }
      return [...prev, { dish, quantity }];
    });
  }, []);

  const setQuantity = useCallback((dishId: string, quantity: number) => {
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.dish.id !== dishId)
        : prev.map((l) => (l.dish.id === dishId ? { ...l, quantity } : l))
    );
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo(
    () => ({
      lines,
      add,
      setQuantity,
      clear,
      count: lines.reduce((n, l) => n + l.quantity, 0),
      subtotal: lines.reduce((sum, l) => sum + l.quantity * l.dish.price, 0),
    }),
    [lines, add, setQuantity, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
