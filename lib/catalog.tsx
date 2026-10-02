import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { Allergen, CHEFS, Category, Chef, DISHES, Dish } from '@/data/menu';
import { useAuth } from './auth';
import type { EmojiName } from './emoji';
import type { Localized } from './i18n';
import { supabase } from './supabase';

/** Average ratings for one chef, from customer reviews. */
export type ChefRating = {
  chef_id: string;
  review_count: number;
  food: number;
  delivery: number;
  packaging: number;
  value: number;
  overall: number;
};

export type KitchenChefRow = {
  id: string;
  user_id: string;
  name: string;
  area: string;
  specialty: string;
  bio: string;
  photo_url?: string | null;
};

export type KitchenDishRow = {
  id: string;
  chef_id: string;
  name: string;
  description: string;
  ingredients: string;
  allergens: Allergen[];
  category: Category;
  price: number;
  prep_minutes: number;
  serves: number;
  spicy: boolean;
  vegetarian: boolean;
  available: boolean;
  photo_url?: string | null;
  portion_grams?: number | null;
};

const same = (text: string): Localized => ({ en: text, ar: text, fr: text });

const CATEGORY_EMOJI: Record<Category, EmojiName> = {
  main: 'pot',
  baked: 'pan',
  seafood: 'fish',
  desserts: 'cake',
  healthy: 'salad',
};

const CHEF_COLORS = ['#FFE3D3', '#D9F0FF', '#FFF1C7', '#FFE0EC', '#DDF5EA', '#E4E1FF'];
const CHEF_EMOJI: EmojiName[] = ['chef_1', 'chef_2', 'chef_3', 'grandma_1', 'grandma_2'];

function hash(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function kitchenChefToChef(row: KitchenChefRow): Chef {
  const h = hash(row.id);
  return {
    id: row.id,
    name: same(row.name),
    emoji: CHEF_EMOJI[h % CHEF_EMOJI.length],
    area: same(row.area),
    specialty: same(row.specialty),
    bio: same(row.bio),
    color: CHEF_COLORS[h % CHEF_COLORS.length],
    kitchen: true,
    photo: row.photo_url ?? undefined,
  };
}

export function kitchenDishToDish(row: KitchenDishRow): Dish {
  const firstSentence = row.description.split(/(?<=[.!?])\s/)[0] ?? '';
  return {
    id: row.id,
    chefId: row.chef_id,
    category: row.category,
    emoji: CATEGORY_EMOJI[row.category] ?? 'pot',
    name: same(row.name),
    short: same(firstSentence.length > 90 ? `${firstSentence.slice(0, 87)}…` : firstSentence),
    description: same(row.description),
    ingredients: same(row.ingredients),
    allergens: row.allergens ?? [],
    price: Number(row.price),
    prepMinutes: row.prep_minutes,
    serves: row.serves,
    spicy: row.spicy,
    vegetarian: row.vegetarian,
    kitchen: true,
    photo: row.photo_url ?? undefined,
    portionGrams: row.portion_grams ?? undefined,
  };
}

type CatalogValue = {
  chefs: Chef[];
  dishes: Dish[];
  ratings: Record<string, ChefRating>;
  /** True once the home chefs' dishes have been fetched for this account. */
  loaded: boolean;
  getChef: (id: string) => Chef | undefined;
  getDish: (id: string) => Dish | undefined;
  dishesByChef: (chefId: string) => Dish[];
  refresh: () => Promise<void>;
};

const CatalogContext = createContext<CatalogValue | null>(null);

/** The menu: built-in chefs plus home chefs approved through the app, with their review averages. */
export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [kitchenChefs, setKitchenChefs] = useState<Chef[]>([]);
  const [kitchenDishes, setKitchenDishes] = useState<Dish[]>([]);
  const [ratings, setRatings] = useState<Record<string, ChefRating>>({});
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!session) {
      setLoaded(false);
      return;
    }
    const [chefsRes, dishesRes, ratingsRes] = await Promise.all([
      supabase.from('kitchen_chefs').select('*').order('created_at', { ascending: true }),
      supabase.from('kitchen_dishes').select('*').order('created_at', { ascending: true }),
      supabase.from('chef_ratings').select('*').order('chef_id', { ascending: true }),
    ]);
    if (!chefsRes.error && chefsRes.data) setKitchenChefs((chefsRes.data as KitchenChefRow[]).map(kitchenChefToChef));
    if (!dishesRes.error && dishesRes.data) {
      // Customers only see dishes a chef has left switched on.
      setKitchenDishes((dishesRes.data as KitchenDishRow[]).filter((d) => d.available).map(kitchenDishToDish));
    }
    if (!ratingsRes.error && ratingsRes.data) {
      setRatings(Object.fromEntries((ratingsRes.data as ChefRating[]).map((r) => [r.chef_id, r])));
    }
    setLoaded(true);
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo<CatalogValue>(() => {
    const chefs = [...CHEFS, ...kitchenChefs];
    const dishes = [...DISHES, ...kitchenDishes.filter((d) => kitchenChefs.some((c) => c.id === d.chefId))];
    return {
      chefs,
      dishes,
      ratings,
      loaded,
      refresh,
      getChef: (id) => chefs.find((c) => c.id === id),
      getDish: (id) => dishes.find((d) => d.id === id),
      dishesByChef: (chefId) => dishes.filter((d) => d.chefId === chefId),
    };
  }, [kitchenChefs, kitchenDishes, ratings, loaded, refresh]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog must be used inside CatalogProvider');
  return ctx;
}
