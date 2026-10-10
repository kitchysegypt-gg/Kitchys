import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from './auth';
import { useCatalog } from './catalog';
import { ChefStatus, useChefStatus } from './chef';
import type { OrderStatus } from './orders';
import { useSounds } from './sound';
import { isDemo, supabase } from './supabase';

/** An order as the chef sees it. */
export type KitchenOrder = {
  id: string;
  items: { dishId: string; name: string; price: number; quantity: number }[];
  subtotal: number;
  address: string;
  notes: string | null;
  status: OrderStatus;
  created_at: string;
  scheduled_for: string | null;
  /** Set when the chef accepted a new order (scheduled orders are cooked later, on the day). */
  accepted_at: string | null;
  /** Set once a Kitchy's rider has taken the order. */
  rider_id: string | null;
};

/** What a chef can do to an order: move it to a status, or accept it for later. */
export type ChefAction = OrderStatus | 'accepted';

export type KitchenStats = {
  days: number;
  today: { orders: number; sales: number; open: number };
  orders: number;
  sales: number;
  prev_orders: number;
  prev_sales: number;
  average_order: number;
  customers: number;
  repeat_customers: number;
  cancelled: number;
  by_day: { day: string; orders: number; sales: number }[];
  by_weekday: { weekday: number; orders: number }[];
  by_hour: { hour: number; orders: number }[];
  top_dishes: { dish_id: string; name: string; qty: number; sales: number }[];
  rating: {
    count: number;
    overall: number | null;
    food: number | null;
    delivery: number | null;
    packaging: number | null;
    value: number | null;
    recent: number | null;
    unanswered: number;
  };
};

/** A "Today's deal" the chef is running: extra portions of a dish at a lower price. */
export type KitchenDeal = {
  id: string;
  dish_id: string;
  price: number;
  quantity: number;
  sold: number;
  expires_at: string;
};

export type KitchenReview = {
  id: string;
  reviewer_name: string | null;
  food: number;
  delivery: number;
  packaging: number;
  value: number;
  comment: string | null;
  chef_reply: string | null;
  created_at: string;
};

type KitchenValue = ChefStatus & {
  orders: KitchenOrder[];
  /** Orders that still need the chef: new, cooking or on the way. */
  openOrders: KitchenOrder[];
  reviews: KitchenReview[];
  /** Deals running today. */
  deals: KitchenDeal[];
  startDeal: (dishId: string, price: number, quantity: number) => Promise<void>;
  endDeal: (dealId: string) => Promise<void>;
  paused: boolean;
  refreshOrders: () => Promise<void>;
  refreshReviews: () => Promise<void>;
  setOrderStatus: (orderId: string, action: ChefAction) => Promise<void>;
  replyToReview: (reviewId: string, reply: string) => Promise<void>;
  setPaused: (paused: boolean) => Promise<void>;
  setDailyLimit: (dishId: string, limit: number | null) => Promise<void>;
  loadStats: (days: number) => Promise<KitchenStats>;
};

const KitchenContext = createContext<KitchenValue | null>(null);

const OPEN: OrderStatus[] = ['placed', 'cooking', 'ready', 'on_the_way'];

/** Everything the chef's kitchen screens share, loaded once for all its tabs. */
export function KitchenProvider({ children }: { children: React.ReactNode }) {
  const status = useChefStatus();
  const { session } = useAuth();
  const { refresh: refreshCatalog } = useCatalog();
  const { playOrderSuccess } = useSounds();
  const chefId = status.kitchen?.id ?? null;
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [reviews, setReviews] = useState<KitchenReview[]>([]);
  const [paused, setPausedState] = useState(false);
  const [deals, setDeals] = useState<KitchenDeal[]>([]);
  const knownIds = useRef<Set<string> | null>(null);

  const refreshOrders = useCallback(async () => {
    if (!chefId) return;
    const { data, error } = await supabase
      .from('orders')
      .select('id, items, subtotal, address, notes, status, created_at, scheduled_for, accepted_at, rider_id')
      .eq('chef_id', chefId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error || !data) return;
    const rows = (data as KitchenOrder[]).map((o) => ({ ...o, subtotal: Number(o.subtotal) }));
    // A ping when a new order comes in (not on the first load).
    if (knownIds.current && rows.some((o) => o.status === 'placed' && !knownIds.current!.has(o.id))) {
      playOrderSuccess();
    }
    knownIds.current = new Set(rows.map((o) => o.id));
    setOrders(rows);
  }, [chefId, playOrderSuccess]);

  const refreshReviews = useCallback(async () => {
    if (!chefId) return;
    const { data } = await supabase
      .from('chef_reviews')
      .select('id, reviewer_name, food, delivery, packaging, value, comment, chef_reply, created_at')
      .eq('chef_id', chefId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setReviews(data as KitchenReview[]);
  }, [chefId]);

  const refreshDeals = useCallback(async () => {
    if (!chefId) return;
    const { data } = await supabase
      .from('dish_deals')
      .select('id, dish_id, price, quantity, sold, expires_at')
      .eq('chef_id', chefId)
      .eq('cancelled', false)
      .gt('expires_at', new Date().toISOString());
    if (data) setDeals((data as KitchenDeal[]).map((d) => ({ ...d, price: Number(d.price) })));
  }, [chefId]);

  const refreshPaused = useCallback(async () => {
    if (!chefId) return;
    const { data } = await supabase.from('chef_hours').select('paused').eq('chef_id', chefId).maybeSingle();
    setPausedState(Boolean(data?.paused));
  }, [chefId]);

  useEffect(() => {
    refreshOrders();
    refreshReviews();
    refreshPaused();
    refreshDeals();
  }, [refreshOrders, refreshReviews, refreshPaused, refreshDeals]);

  // Live: new orders and status changes arrive without pulling to refresh.
  useEffect(() => {
    if (!chefId || !session || isDemo) return;
    const channel = supabase
      .channel(`kitchen-${chefId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `chef_id=eq.${chefId}` }, () => {
        refreshOrders();
        // A new order can use up a deal's portions.
        refreshDeals();
      })
      .subscribe();
    // A slow poll as a safety net in case the live connection drops.
    const timer = setInterval(refreshOrders, 60_000);
    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [chefId, session, refreshOrders, refreshDeals]);

  const setOrderStatus = useCallback(
    async (orderId: string, next: ChefAction) => {
      const { error } = await supabase.rpc('chef_set_order_status', { p_order: orderId, p_status: next });
      if (error) throw error;
      const now = new Date().toISOString();
      setOrders((prev) =>
        prev.map((o) =>
          o.id !== orderId
            ? o
            : next === 'accepted'
              ? { ...o, accepted_at: o.accepted_at ?? now }
              : { ...o, status: next, accepted_at: next === 'cooking' ? (o.accepted_at ?? now) : o.accepted_at }
        )
      );
    },
    []
  );

  const replyToReview = useCallback(async (reviewId: string, reply: string) => {
    const { error } = await supabase.rpc('reply_to_review', { p_review: reviewId, p_reply: reply });
    if (error) throw error;
    const text = reply.trim() || null;
    setReviews((prev) => prev.map((r) => (r.id === reviewId ? { ...r, chef_reply: text } : r)));
  }, []);

  const setPaused = useCallback(
    async (next: boolean) => {
      const { error } = await supabase.rpc('set_kitchen_paused', { p_paused: next });
      if (error) throw error;
      setPausedState(next);
      await refreshCatalog();
    },
    [refreshCatalog]
  );

  const setDailyLimit = useCallback(
    async (dishId: string, limit: number | null) => {
      const { error } = await supabase.from('kitchen_dishes').update({ daily_limit: limit }).eq('id', dishId);
      if (error) throw error;
      await status.reload();
    },
    [status]
  );

  const startDeal = useCallback(
    async (dishId: string, price: number, quantity: number) => {
      const { error } = await supabase.rpc('start_deal', { p_dish: dishId, p_price: price, p_quantity: quantity });
      if (error) throw error;
      await Promise.all([refreshDeals(), refreshCatalog()]);
    },
    [refreshDeals, refreshCatalog]
  );

  const endDeal = useCallback(
    async (dealId: string) => {
      const { error } = await supabase.rpc('end_deal', { p_deal: dealId });
      if (error) throw error;
      await Promise.all([refreshDeals(), refreshCatalog()]);
    },
    [refreshDeals, refreshCatalog]
  );

  const loadStats = useCallback(async (days: number) => {
    const { data, error } = await supabase.rpc('my_kitchen_stats', { p_days: days });
    if (error) throw error;
    return data as KitchenStats;
  }, []);

  const value = useMemo<KitchenValue>(
    () => ({
      ...status,
      orders,
      openOrders: orders.filter((o) => OPEN.includes(o.status)),
      reviews,
      deals,
      startDeal,
      endDeal,
      paused,
      refreshOrders,
      refreshReviews,
      setOrderStatus,
      replyToReview,
      setPaused,
      setDailyLimit,
      loadStats,
    }),
    [status, orders, reviews, deals, startDeal, endDeal, paused, refreshOrders, refreshReviews, setOrderStatus, replyToReview, setPaused, setDailyLimit, loadStats]
  );

  return <KitchenContext.Provider value={value}>{children}</KitchenContext.Provider>;
}

export function useKitchen() {
  const value = useContext(KitchenContext);
  if (!value) throw new Error('useKitchen must be used inside KitchenProvider');
  return value;
}

/** The next step a chef can take on an order. */
export type NextStep = {
  action: ChefAction;
  label: 'acceptAndCook' | 'acceptOrder' | 'startCooking' | 'sendOut' | 'markDelivered' | 'readyForPickup' | 'deliverMyself';
  icon: 'flame-outline' | 'checkmark-circle-outline' | 'delivery' | 'checkmark-done-outline' | 'bag-check-outline';
  /** Cooking a scheduled order only unlocks on its delivery day. */
  lockedUntil?: Date;
};

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function nextStep(order: KitchenOrder, now = new Date()): NextStep | null {
  if (order.status === 'placed') {
    // "As soon as possible": accepting means cooking straight away.
    if (!order.scheduled_for) return { action: 'cooking', label: 'acceptAndCook', icon: 'flame-outline' };
    if (!order.accepted_at) return { action: 'accepted', label: 'acceptOrder', icon: 'checkmark-circle-outline' };
    const day = dayStart(new Date(order.scheduled_for));
    return {
      action: 'cooking',
      label: 'startCooking',
      icon: 'flame-outline',
      lockedUntil: day > dayStart(now) ? day : undefined,
    };
  }
  if (order.status === 'cooking') return { action: 'ready', label: 'readyForPickup', icon: 'bag-check-outline' };
  // Once a Kitchy's rider has the order, the rider moves it along.
  if (order.rider_id) return null;
  if (order.status === 'ready') return { action: 'on_the_way', label: 'deliverMyself', icon: 'delivery' };
  if (order.status === 'on_the_way') return { action: 'delivered', label: 'markDelivered', icon: 'checkmark-done-outline' };
  return null;
}

/** Kitchy's commission on food sales (not on delivery fees). */
export const COMMISSION_RATE = 0.15;
export const splitSales = (sales: number) => {
  const commission = Math.round(sales * COMMISSION_RATE);
  return { commission, earnings: sales - commission };
};

export const canDecline = (status: OrderStatus) => status === 'placed' || status === 'cooking' || status === 'ready';

/** Leaves the kitchen and goes back to the customer app. */
export const leaveKitchen = () => (router.canGoBack() ? router.back() : router.replace('/more'));
