import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { Dish } from '@/data/menu';

import { useAuth } from './auth';
import { useCatalog } from './catalog';
import { useSettings } from './settings';
import { isDemo, supabase } from './supabase';

export type CartLine = { dish: Dish; quantity: number };

type SavedItem = { dish_id: string; name: string; quantity: number };

type CartContextValue = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  add: (dish: Dish, quantity?: number) => void;
  setQuantity: (dishId: string, quantity: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

/** How long the cart has to stay unchanged before it's saved to the account. */
const SAVE_DELAY_MS = 1500;

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const { session } = useAuth();
  const { loaded: catalogLoaded, getDish } = useCatalog();
  const { l } = useSettings();
  const userId = session?.user.id ?? null;

  // The cart is kept on the account so it survives restarts and the "your cart is calling"
  // reminder can see it. `syncedFor` is the account whose saved cart has been restored.
  const [syncedFor, setSyncedFor] = useState<string | null>(null);
  const lastSaved = useRef<string | null>(null);
  const currentUser = useRef(userId);
  currentUser.current = userId;

  // After signing out, the next sign-in restores that account's saved cart again.
  useEffect(() => {
    if (!userId) setSyncedFor(null);
  }, [userId]);

  useEffect(() => {
    if (isDemo || !userId || !catalogLoaded || syncedFor === userId) return;
    let cancelled = false;
    supabase
      .from('saved_carts')
      .select('items')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        const saved = ((data?.items as SavedItem[] | undefined) ?? []).flatMap((item) => {
          const dish = getDish(item.dish_id);
          return dish ? [{ dish, quantity: item.quantity }] : [];
        });
        // Anything added before the saved cart arrived wins.
        if (saved.length) setLines((prev) => (prev.length ? prev : saved));
        lastSaved.current = error ? null : JSON.stringify(data?.items ?? []);
        setSyncedFor(userId);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, catalogLoaded, getDish, syncedFor]);

  useEffect(() => {
    if (isDemo || !userId || syncedFor !== userId) return;
    const items: SavedItem[] = lines.map((line) => ({
      dish_id: line.dish.id,
      name: l(line.dish.name),
      quantity: line.quantity,
    }));
    const serialized = JSON.stringify(items);
    if (serialized === lastSaved.current) return;
    const timer = setTimeout(() => {
      // Signing out clears the cart on this phone; keep the copy saved on the account.
      if (currentUser.current !== userId) return;
      supabase.rpc('save_cart', { p_items: items }).then(({ error }) => {
        if (!error) lastSaved.current = serialized;
      });
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [lines, userId, syncedFor, l]);

  const add = useCallback((dish: Dish, quantity = 1) => {
    setLines((prev) => {
      const existing = prev.find((line) => line.dish.id === dish.id);
      if (existing) {
        return prev.map((line) => (line.dish.id === dish.id ? { ...line, quantity: line.quantity + quantity } : line));
      }
      return [...prev, { dish, quantity }];
    });
  }, []);

  const setQuantity = useCallback((dishId: string, quantity: number) => {
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((line) => line.dish.id !== dishId)
        : prev.map((line) => (line.dish.id === dishId ? { ...line, quantity } : line))
    );
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo(
    () => ({
      lines,
      add,
      setQuantity,
      clear,
      count: lines.reduce((n, line) => n + line.quantity, 0),
      subtotal: lines.reduce((sum, line) => sum + line.quantity * line.dish.price, 0),
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
