import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import type { Allergen, Category } from '@/data/menu';
import { useAuth } from './auth';
import type { KitchenChefRow, KitchenDishRow } from './catalog';
import { isDemo, supabase } from './supabase';

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
  /** Picked photos (up to MAX_DISH_PHOTOS, cover first): local files until uploaded, then public links. */
  photos: string[];
  /** Portion size as typed, in `portionUnit`. Optional. */
  portionAmount: string;
  portionUnit: 'g' | 'kg';
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
  photos: [],
  portionAmount: '',
  portionUnit: 'g',
});

/** The typed size in grams, or null when it's left empty or out of range (10 g to 20 kg). */
export function portionGrams(d: Pick<DishDraft, 'portionAmount' | 'portionUnit'>) {
  const amount = Number(d.portionAmount.replace(',', '.'));
  if (!d.portionAmount.trim() || !(amount > 0)) return null;
  const grams = Math.round(d.portionUnit === 'kg' ? amount * 1000 : amount);
  return grams >= 10 && grams <= 20000 ? grams : null;
}

/**
 * Uploads a picked photo to the kitchen-photos bucket (into the person's own folder)
 * and returns its public link. Links that are already uploaded are returned as they are.
 */
export async function uploadKitchenPhoto(uri: string | null): Promise<string | null> {
  if (!uri) return null;
  // The demo keeps photos in the browser.
  if (isDemo || /^https?:\/\//.test(uri)) return uri;
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error('Sign in first');
  const response = await fetch(uri);
  const body = await response.arrayBuffer();
  const type = response.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('kitchen-photos').upload(path, body, { contentType: type });
  if (error) throw error;
  return supabase.storage.from('kitchen-photos').getPublicUrl(path).data.publicUrl;
}

/** A dish can show up to this many photos; the first is the cover. */
export const MAX_DISH_PHOTOS = 4;

/** Dishes need a real description and ingredient list (also enforced by the database). */
export const MIN_DESCRIPTION_WORDS = 10;
export const MIN_INGREDIENT_WORDS = 3;

export const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

export const isDishReady = (d: DishDraft) =>
  d.photos.length >= 1 &&
  d.name.trim().length >= 2 &&
  Number(d.price) > 0 &&
  wordCount(d.description) >= MIN_DESCRIPTION_WORDS &&
  wordCount(d.ingredients) >= MIN_INGREDIENT_WORDS;

/** Shape stored in the application (read by approve_chef_application) and kitchen_dishes. */
export async function dishPayload(d: DishDraft) {
  const photoUrls = await uploadDishPhotos(d.photos);
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
    photoUrl: photoUrls[0] ?? null,
    photoUrls,
    portionGrams: portionGrams(d),
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
  photo: string | null;
  dishes: DishDraft[];
  /** Where the chef cooks; customers within the delivery radius can order. */
  kitchen: { latitude: number; longitude: number };
}) {
  const { photo, dishes, kitchen, ...details } = form;
  const [photoUrl, dishRows] = await Promise.all([uploadKitchenPhoto(photo), Promise.all(dishes.map(dishPayload))]);
  const { data, error } = await supabase
    .from('chef_applications')
    .insert({
      ...details,
      photo_url: photoUrl,
      dishes: dishRows,
      kitchen_lat: kitchen.latitude,
      kitchen_lng: kitchen.longitude,
    })
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
  const d = await dishPayload(draft);
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
    photo_urls: d.photoUrls,
    portion_grams: d.portionGrams,
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

/** Approved chefs: upload a new profile photo and show it on their chef page. */
export async function setKitchenPhoto(uri: string) {
  const url = await uploadKitchenPhoto(uri);
  const { error } = await supabase.rpc('set_kitchen_photo', { p_url: url });
  if (error) throw error;
}

/** Approved chefs: add or replace the photo of one of their dishes. */
/** Uploads any new photos (already-uploaded links are kept as they are). */
async function uploadDishPhotos(photos: string[]) {
  const urls = await Promise.all(photos.slice(0, MAX_DISH_PHOTOS).map(uploadKitchenPhoto));
  return urls.filter((u): u is string => !!u);
}

/** Approved chefs: replace a dish's photos (cover first). */
export async function setDishPhotos(dishId: string, photos: string[]) {
  const photo_urls = await uploadDishPhotos(photos);
  const { error } = await supabase.from('kitchen_dishes').update({ photo_urls }).eq('id', dishId);
  if (error) throw error;
}

/** Approved chefs: their kitchen location (private; only they can read it). */
export async function fetchKitchenLocation(): Promise<{ latitude: number; longitude: number } | null> {
  const { data, error } = await supabase.rpc('my_kitchen_location');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  return row ? { latitude: row.latitude, longitude: row.longitude } : null;
}

export async function setKitchenLocation(c: { latitude: number; longitude: number }) {
  const { error } = await supabase.rpc('set_kitchen_location', { p_lat: c.latitude, p_lng: c.longitude });
  if (error) throw error;
}

/** The signed-in chef's last delivery time, in minutes after midnight (1 PM - 11 PM). */
export async function setLastDelivery(minutes: number) {
  const { error } = await supabase.rpc('set_last_delivery', { p_minutes: minutes });
  if (error) throw error;
}
