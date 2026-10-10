import { useCallback, useEffect, useState } from 'react';

import type { Localized } from '@/lib/i18n';

import { uploadKitchenPhoto } from './chef';
import { supabase } from './supabase';

/** Kitchy's Premium for chefs: EGP 320 a month, taken from their earnings. */
export const PREMIUM_COMMISSION_RATE = 0.12;

export type Appliance = 'oven' | 'stove' | 'air_fryer' | 'fridge' | 'mixer' | 'other';
export const APPLIANCES: Appliance[] = ['oven', 'stove', 'air_fryer', 'fridge', 'mixer', 'other'];

export type CareRequest = {
  id: string;
  appliance: Appliance;
  problem: string;
  status: 'open' | 'done' | 'cancelled';
  created_at: string;
};

export type ShopOrder = {
  id: string;
  item_id: string;
  method: 'points' | 'instalments';
  points_spent: number;
  months: number | null;
  monthly: number | null;
  status: 'requested' | 'delivered' | 'cancelled';
  created_at: string;
  delivered_at: string | null;
};

export type ShopItem = {
  id: string;
  name: Localized;
  description: Localized;
  emoji: string;
  price: number;
  points: number;
};

export type PremiumInfo = {
  active: boolean;
  price: number;
  /** End of the month already paid for. */
  period_end: string | null;
  cancel_at_period_end: boolean;
  /** Kitchy's Care opens 30 days after subscribing. */
  care_from: string | null;
  care_used: number;
  care_limit: number;
  points: number;
  /** 2 for Premium kitchens, else 1 (points per EGP 10 of food delivered). */
  points_multiplier: number;
  care_requests: CareRequest[];
  shop_orders: ShopOrder[];
};

/** Emails the Kitchy's team (a failed email doesn't undo what the chef did). */
const tellTeam = (kind: 'premium' | 'care' | 'shop', id?: string) =>
  supabase.functions.invoke('kitchen-requests', { body: { kind, id } }).catch(() => null);

/** Everything on the Premium screen: subscription, points, chef shop and Kitchy's Care. */
export function usePremium() {
  const [info, setInfo] = useState<PremiumInfo | null>(null);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [premiumRes, itemsRes] = await Promise.all([
      supabase.rpc('my_premium'),
      supabase.from('shop_items').select('id, name, description, emoji, price, points').order('sort'),
    ]);
    if (!premiumRes.error && premiumRes.data) setInfo(premiumRes.data as PremiumInfo);
    if (!itemsRes.error && Array.isArray(itemsRes.data)) {
      setItems((itemsRes.data as ShopItem[]).map((i) => ({ ...i, price: Number(i.price) })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const run = useCallback(
    async (fn: string, args?: Record<string, unknown>) => {
      const { data, error } = await supabase.rpc(fn, args);
      if (error) throw error;
      await refresh();
      return data;
    },
    [refresh]
  );

  const subscribe = useCallback(async () => {
    const wasActive = info?.active;
    await run('premium_subscribe');
    if (!wasActive) tellTeam('premium');
  }, [run, info?.active]);

  const cancel = useCallback(() => run('premium_cancel').then(() => undefined), [run]);

  const redeem = useCallback(
    async (itemId: string, method: 'points' | 'instalments') => {
      const id = (await run('shop_redeem', { p_item: itemId, p_method: method })) as string;
      tellTeam('shop', id);
    },
    [run]
  );

  const requestCare = useCallback(
    async (appliance: Appliance, problem: string, photoUri: string | null) => {
      const photo = await uploadKitchenPhoto(photoUri);
      const id = (await run('care_request', { p_appliance: appliance, p_problem: problem, p_photo: photo })) as string;
      tellTeam('care', id);
    },
    [run]
  );

  return { info, items, loading, refresh, subscribe, cancel, redeem, requestCare };
}
