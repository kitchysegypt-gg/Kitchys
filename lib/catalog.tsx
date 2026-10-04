import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { Allergen, CHEFS, Category, Chef, DISHES, Dish } from '@/data/menu';
import { useAuth } from './auth';
import type { EmojiName } from './emoji';
import type { Localized } from './i18n';
import { CLOSE_MINUTES } from './schedule';
import { useSettings } from './settings';
import { supabase } from './supabase';

/** A chef is "Popular" with at least this many orders in the last 30 days. */
export const POPULAR_MIN_ORDERS = 5;

/** Badges shown on chefs. Every chef on Kitchy's is a home cook approved by the team. */
export type ChefTag = 'popular' | 'verified' | 'homemade';

/** Chefs deliver within this distance of their kitchen (the database decides; this is for messages). */
export const DELIVERY_RADIUS_KM = 15;

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
  /** Up to 4 photos; the first is the cover (photo_url). */
  photo_urls?: string[] | null;
  portion_grams?: number | null;
  /** Most portions the chef will cook per day; null means no limit. */
  daily_limit?: number | null;
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
    photo: row.photo_urls?.[0] ?? row.photo_url ?? undefined,
    photos: row.photo_urls?.length ? row.photo_urls : row.photo_url ? [row.photo_url] : undefined,
    portionGrams: row.portion_grams ?? undefined,
    dailyLimit: row.daily_limit ?? undefined,
  };
}

type CatalogValue = {
  /** Chefs who deliver to the customer's address (everyone until an address is set). */
  chefs: Chef[];
  /** Dishes from those chefs. */
  dishes: Dish[];
  /** False when the chef is too far from the customer's address. */
  isNear: (chefId: string) => boolean;
  /** Popular (busy in the last 30 days), Verified and Homemade badges for a chef. */
  chefTags: (chefId: string) => ChefTag[];
  /** The chef's last delivery time, in minutes after midnight (9 PM until they pick one). */
  lastDelivery: (chefId: string) => number;
  /** True when the chef has paused orders (their kitchen is left out of the lists). */
  isPaused: (chefId: string) => boolean;
  /** Portions of a dish still available today, or null when it has no daily limit. */
  portionsLeft: (dish: Dish) => number | null;
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
  // Orders per chef in the last 30 days.
  const [popularity, setPopularity] = useState<Record<string, number>>({});
  const [lastDeliveries, setLastDeliveries] = useState<Record<string, number>>({});
  const [pausedIds, setPausedIds] = useState<Set<string>>(new Set());
  // Portions ordered per dish for today.
  const [ordered, setOrdered] = useState<Record<string, number>>({});
  const { location } = useSettings();
  const lat = location?.latitude;
  const lng = location?.longitude;
  // Ids of chefs within reach of the delivery address; null until an address is set.
  const [nearIds, setNearIds] = useState<Set<string> | null>(null);

  const fetchNear = useCallback(async () => {
    if (!session || lat === undefined || lng === undefined) {
      setNearIds(null);
      return;
    }
    const { data, error } = await supabase.rpc('chefs_near', { p_lat: lat, p_lng: lng });
    if (!error) setNearIds(new Set((data ?? []) as string[]));
  }, [session, lat, lng]);

  useEffect(() => {
    fetchNear();
  }, [fetchNear]);

  const refresh = useCallback(async () => {
    if (!session) {
      setLoaded(false);
      return;
    }
    const [chefsRes, dishesRes, ratingsRes, popularRes, hoursRes, orderedRes] = await Promise.all([
      supabase.from('kitchen_chefs').select('*').order('created_at', { ascending: true }),
      supabase.from('kitchen_dishes').select('*').order('created_at', { ascending: true }),
      supabase.from('chef_ratings').select('*').order('chef_id', { ascending: true }),
      supabase.rpc('chef_popularity'),
      supabase.from('chef_hours').select('chef_id, last_delivery_minutes, paused'),
      supabase.rpc('dish_portions_ordered'),
    ]);
    if (!orderedRes.error && Array.isArray(orderedRes.data)) {
      setOrdered(
        Object.fromEntries((orderedRes.data as { dish_id: string; portions: number }[]).map((r) => [r.dish_id, r.portions]))
      );
    }
    if (!hoursRes.error && Array.isArray(hoursRes.data)) {
      setLastDeliveries(
        Object.fromEntries(
          (hoursRes.data as { chef_id: string; last_delivery_minutes: number }[]).map((r) => [
            r.chef_id,
            r.last_delivery_minutes,
          ])
        )
      );
      setPausedIds(new Set((hoursRes.data as { chef_id: string; paused: boolean }[]).filter((r) => r.paused).map((r) => r.chef_id)));
    }
    if (!popularRes.error && Array.isArray(popularRes.data)) {
      setPopularity(
        Object.fromEntries(
          (popularRes.data as { chef_id: string; recent_orders: number }[]).map((r) => [r.chef_id, r.recent_orders])
        )
      );
    }
    if (!chefsRes.error && chefsRes.data) setKitchenChefs((chefsRes.data as KitchenChefRow[]).map(kitchenChefToChef));
    if (!dishesRes.error && dishesRes.data) {
      // Customers only see dishes a chef has left switched on.
      setKitchenDishes((dishesRes.data as KitchenDishRow[]).filter((d) => d.available).map(kitchenDishToDish));
    }
    if (!ratingsRes.error && ratingsRes.data) {
      setRatings(Object.fromEntries((ratingsRes.data as ChefRating[]).map((r) => [r.chef_id, r])));
    }
    await fetchNear();
    setLoaded(true);
  }, [session, fetchNear]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo<CatalogValue>(() => {
    const allChefs = [...CHEFS, ...kitchenChefs];
    const allDishes = [...DISHES, ...kitchenDishes.filter((d) => kitchenChefs.some((c) => c.id === d.chefId))];
    const isNear = (chefId: string) => !nearIds || nearIds.has(chefId);
    const isPaused = (chefId: string) => pausedIds.has(chefId);
    const listed = (chefId: string) => isNear(chefId) && !isPaused(chefId);
    return {
      chefs: allChefs.filter((c) => listed(c.id)),
      dishes: allDishes.filter((d) => listed(d.chefId)),
      isNear,
      isPaused,
      portionsLeft: (dish) => (dish.dailyLimit ? Math.max(0, dish.dailyLimit - (ordered[dish.id] ?? 0)) : null),
      chefTags: (chefId) => [
        ...((popularity[chefId] ?? 0) >= POPULAR_MIN_ORDERS ? (['popular'] as const) : []),
        'verified',
        'homemade',
      ],
      lastDelivery: (chefId) => lastDeliveries[chefId] ?? CLOSE_MINUTES,
      ratings,
      loaded,
      refresh,
      // Orders, reviews and chef pages still find chefs who are out of reach.
      getChef: (id) => allChefs.find((c) => c.id === id),
      getDish: (id) => allDishes.find((d) => d.id === id),
      dishesByChef: (chefId) => allDishes.filter((d) => d.chefId === chefId),
    };
  }, [kitchenChefs, kitchenDishes, ratings, loaded, refresh, nearIds, popularity, lastDeliveries, pausedIds, ordered]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog must be used inside CatalogProvider');
  return ctx;
}
