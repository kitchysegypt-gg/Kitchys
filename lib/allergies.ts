import { useCallback } from 'react';

import type { Allergen, Dish } from '@/data/menu';
import { useAuth } from './auth';
import { supabase } from './supabase';

export const ALL_ALLERGENS: Allergen[] = ['gluten', 'dairy', 'eggs', 'nuts', 'peanuts', 'fish', 'shellfish', 'soy', 'sesame'];

/**
 * The customer's allergies, saved on their account. Dishes that contain one get a warning;
 * nothing is hidden, since people also order for others.
 */
export function useMyAllergies() {
  const { session } = useAuth();
  const saved = session?.user.user_metadata?.allergies;
  const allergies: Allergen[] = Array.isArray(saved) ? saved.filter((a): a is Allergen => ALL_ALLERGENS.includes(a)) : [];

  const save = useCallback(async (next: Allergen[]) => {
    const { error } = await supabase.auth.updateUser({ data: { allergies: next } });
    if (error) throw error;
  }, []);

  /** The customer's allergies this dish contains. */
  const clashes = useCallback(
    (dish: Pick<Dish, 'allergens'>) => (dish.allergens ?? []).filter((a) => allergies.includes(a)),
    // The list changes only when the account is saved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allergies.join(',')]
  );

  return { allergies, save, clashes };
}
