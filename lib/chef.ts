import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import type { Allergen, Category } from '@/data/menu';
import { useAuth } from './auth';
import type { KitchenChefRow, KitchenDishRow } from './catalog';
import { supabase } from './supabase';

/** A dish as typed in the application or kitchen form. */
export type DishDraft = {
  name: string;
  description: string;
  ingredients: string;
  price: string;
  prepMinutes: string;
  serves: string;
  category: Category;
  allergens: Allergen[];
  spicy: boolean;
  vegetarian: boolean;
};

export const emptyDish = (): DishDraft => ({
  name: '',
  description: '',
  ingredients: '',
  price: '',
  prepMinutes: '30',
  serves: '1',
  category: 'main',
  allergens: [],
  spicy: false,
  vegetarian: false,
});

export const isDishReady = (d: DishDraft) => d.name.trim().length >= 2 && Number(d.price) > 0;

/** Shape stored in the application (read by approve_chef_application) and kitchen_dishes. */
export function dishPayload(d: DishDraft) {
  return {
    name: d.name.trim(),
    description: d.description.trim(),
    ingredients: d.ingredients.trim(),
    price: Math.round(Number(d.price)),
    prepMinutes: Math.min(240, Math.max(5, Number(d.prepMinutes) || 30)),
    serves: Math.min(12, Math.max(1, Number(d.serves) || 1)),
    category: d.category,
    allergens: d.allergens,
    spicy: d.spicy,
    vegetarian: d.vegetarian,
  };
}

export type ApplicationRow = {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  full_name: string;
  created_at: string;
};

export type ChefStatus = {
  loading: boolean;
  application: ApplicationRow | null;
  kitchen: KitchenChefRow | null;
  dishes: KitchenDishRow[];
  reload: () => Promise<void>;
};

/** The signed-in person's chef application and, once approved, their kitchen. */
export function useChefStatus(): ChefStatus {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<ApplicationRow | null>(null);
  const [kitchen, setKitchen] = useState<KitchenChefRow | null>(null);
  const [dishes, setDishes] = useState<KitchenDishRow[]>([]);

  const reload = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const userId = session.user.id;
    const [appRes, kitchenRes] = await Promise.all([
      supabase
        .from('chef_applications')
        .select('id, status, full_name, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase.from('kitchen_chefs').select('*').eq('user_id', userId).limit(1),
    ]);
    const app = (appRes.data?.[0] as ApplicationRow | undefined) ?? null;
    const chef = (kitchenRes.data?.[0] as KitchenChefRow | undefined) ?? null;
    setApplication(app);
    setKitchen(chef);
    if (chef) {
      const { data } = await supabase
        .from('kitchen_dishes')
        .select('*')
        .eq('chef_id', chef.id)
        .order('created_at', { ascending: true });
      setDishes((data ?? []) as KitchenDishRow[]);
    } else {
      setDishes([]);
    }
    setLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  return { loading, application, kitchen, dishes, reload };
}

export async function submitApplication(form: {
  full_name: string;
  phone: string;
  area: string;
  specialty: string;
  bio: string;
  dishes: DishDraft[];
}) {
  const { data, error } = await supabase
    .from('chef_applications')
    .insert({ ...form, dishes: form.dishes.map(dishPayload) })
    .select('id')
    .single();
  if (error) throw error;
  // Emails the Kitchy's team (a failed email doesn't undo the application).
  const { data: notify } = await supabase.functions
    .invoke('chef-applications', { body: { application_id: data.id } })
    .catch(() => ({ data: null }));
  return { id: data.id as string, emailed: Boolean(notify?.emailed) };
}

export async function addKitchenDish(chefId: string, draft: DishDraft) {
  const d = dishPayload(draft);
  const { error } = await supabase.from('kitchen_dishes').insert({
    chef_id: chefId,
    name: d.name,
    description: d.description,
    ingredients: d.ingredients,
    price: d.price,
    prep_minutes: d.prepMinutes,
    serves: d.serves,
    category: d.category,
    allergens: d.allergens,
    spicy: d.spicy,
    vegetarian: d.vegetarian,
  });
  if (error) throw error;
}

export async function setDishAvailable(dishId: string, available: boolean) {
  const { error } = await supabase.from('kitchen_dishes').update({ available }).eq('id', dishId);
  if (error) throw error;
}

export async function deleteKitchenDish(dishId: string) {
  const { error } = await supabase.from('kitchen_dishes').delete().eq('id', dishId);
  if (error) throw error;
}
