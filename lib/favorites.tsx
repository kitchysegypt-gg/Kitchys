import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from './auth';
import { supabase } from './supabase';

/** The customer's favourite meals (dish ids), saved to their account. */
type FavoritesValue = {
  ids: Set<string>;
  isFavorite: (dishId: string) => boolean;
  /** Adds or removes the dish; returns true when it is now a favourite. */
  toggle: (dishId: string) => Promise<boolean>;
};

const FavoritesContext = createContext<FavoritesValue | null>(null);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!session) {
      setIds(new Set());
      return;
    }
    supabase
      .from('favorite_dishes')
      .select('dish_id')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setIds(new Set((data as { dish_id: string }[]).map((r) => r.dish_id)));
      });
  }, [session]);

  const toggle = useCallback(
    async (dishId: string) => {
      if (!session) return false;
      const adding = !ids.has(dishId);
      // Show it straight away; undo if the server says no.
      const flip = (on: boolean) =>
        setIds((prev) => {
          const next = new Set(prev);
          if (on) next.add(dishId);
          else next.delete(dishId);
          return next;
        });
      flip(adding);
      const { error } = adding
        ? await supabase.from('favorite_dishes').insert({ dish_id: dishId })
        : await supabase.from('favorite_dishes').delete().eq('dish_id', dishId);
      if (error && error.code !== '23505') {
        flip(!adding);
        throw error;
      }
      return adding;
    },
    [ids, session]
  );

  const value = useMemo<FavoritesValue>(
    () => ({ ids, isFavorite: (dishId) => ids.has(dishId), toggle }),
    [ids, toggle]
  );
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used inside FavoritesProvider');
  return ctx;
}
