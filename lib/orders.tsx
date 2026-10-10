import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from './auth';
import { Rank, nextRank, rankFor } from './loyalty';
import { FREE_DELIVERY_ORDERS, isDemo, supabase } from './supabase';

export type OrderStatus = 'placed' | 'cooking' | 'on_the_way' | 'delivered' | 'cancelled';

export type OrderItem = {
  dishId: string;
  name: string;
  price: number;
  quantity: number;
};

export type Order = {
  id: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  delivery_fee: number;
  /** Packaging fee (EGP 20; 0 on older orders). */
  service_fee: number;
  total: number;
  points_earned: number;
  voucher_id: string | null;
  address: string | null;
  notes: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  /** Chosen delivery time, or null for as soon as possible. */
  scheduled_for: string | null;
  /** Set when the chef accepted the order (before cooking it on the day). */
  accepted_at?: string | null;
  /** Kitchy's credit taken off this order. */
  credit_used: number;
  /** A friend's referral code used on this (first) order. */
  referral_code: string | null;
  status: OrderStatus;
  created_at: string;
};

export type Voucher = {
  id: string;
  reward_id: string;
  cost: number;
  status: 'available' | 'used';
  order_id: string | null;
  created_at: string;
};

type NewOrder = Pick<Order, 'items' | 'subtotal' | 'address' | 'notes'> &
  Partial<Pick<Order, 'voucher_id' | 'delivery_lat' | 'delivery_lng' | 'scheduled_for' | 'referral_code'>> & {
    /** Take the customer's credit off this order. */
    use_credit?: boolean;
  };

type OrdersContextValue = {
  orders: Order[];
  vouchers: Voucher[];
  availableVouchers: Voucher[];
  loading: boolean;
  /** True once the first fetch for the current user has finished. */
  loaded: boolean;
  freeDeliveriesLeft: number;
  /** Non-cancelled orders; decides the customer's rank. */
  orderCount: number;
  points: number;
  /** Kitchy's credit (EGP) from referrals, taken off orders at checkout. */
  credit: number;
  rank: Rank;
  next: Rank | undefined;
  refresh: () => Promise<void>;
  placeOrder: (order: NewOrder) => Promise<Order>;
  /** Cancels the customer's own order; only possible before the chef starts cooking. */
  cancelOrder: (orderId: string) => Promise<void>;
  redeem: (rewardId: string) => Promise<Voucher>;
};

const OrdersContext = createContext<OrdersContextValue | null>(null);

// Postgres numeric columns arrive as strings.
function normalize(row: any): Order {
  return {
    ...row,
    subtotal: Number(row.subtotal),
    discount: Number(row.discount ?? 0),
    delivery_fee: Number(row.delivery_fee),
    service_fee: Number(row.service_fee ?? 0),
    total: Number(row.total),
    points_earned: Number(row.points_earned ?? 0),
    credit_used: Number(row.credit_used ?? 0),
  };
}

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [credit, setCredit] = useState(0);

  const refresh = useCallback(async () => {
    if (!session) {
      setOrders([]);
      setVouchers([]);
      setCredit(0);
      setLoaded(false);
      return;
    }
    setLoading(true);
    const [ordersRes, vouchersRes, creditRes] = await Promise.all([
      // Only the customer's own orders (chefs can also read their kitchen's orders).
      supabase.from('orders').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }),
      supabase.from('reward_vouchers').select('*').order('created_at', { ascending: false }),
      supabase.rpc('my_wallet_balance', {}),
    ]);
    if (!creditRes.error) setCredit(Math.max(0, Number(creditRes.data ?? 0)));
    setLoading(false);
    setLoaded(true);
    if (!ordersRes.error && ordersRes.data) setOrders(ordersRes.data.map(normalize));
    if (!vouchersRes.error && vouchersRes.data) setVouchers(vouchersRes.data as Voucher[]);
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Live: the chef accepting, sending out or delivering an order shows up straight away.
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId || isDemo) return;
    const channel = supabase
      .channel(`orders-${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as { id: string; status: OrderStatus; accepted_at: string | null };
          setOrders((prev) =>
            prev.map((o) => (o.id === row.id ? { ...o, status: row.status, accepted_at: row.accepted_at } : o))
          );
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const placeOrder = useCallback(
    async (order: NewOrder) => {
      // Prices, delivery fee, discount and points are all decided by a database trigger.
      const { data, error } = await supabase.from('orders').insert(order).select().single();
      if (error) throw error;
      const created = normalize(data);
      setOrders((prev) => [created, ...prev]);
      if (order.voucher_id || order.use_credit) await refresh();
      return created;
    },
    [refresh]
  );

  const cancelOrder = useCallback(
    async (orderId: string) => {
      const { error } = await supabase.rpc('cancel_my_order', { p_order: orderId });
      if (error) throw error;
      // Vouchers and credit come back, so reload everything.
      await refresh();
    },
    [refresh]
  );

  const redeem = useCallback(async (rewardId: string) => {
    const { data, error } = await supabase.rpc('redeem_reward', { p_reward_id: rewardId });
    if (error) throw error;
    const voucher = data as Voucher;
    setVouchers((prev) => [voucher, ...prev]);
    return voucher;
  }, []);

  const value = useMemo(() => {
    const counted = orders.filter((o) => o.status !== 'cancelled');
    const earned = counted.reduce((sum, o) => sum + o.points_earned, 0);
    const spent = vouchers.reduce((sum, v) => sum + v.cost, 0);
    return {
      orders,
      vouchers,
      availableVouchers: vouchers.filter((v) => v.status === 'available'),
      loading,
      loaded,
      refresh,
      placeOrder,
      cancelOrder,
      redeem,
      orderCount: counted.length,
      points: Math.max(0, earned - spent),
      credit,
      rank: rankFor(counted.length),
      next: nextRank(counted.length),
      freeDeliveriesLeft: Math.max(0, FREE_DELIVERY_ORDERS - counted.length),
    };
  }, [orders, vouchers, credit, loading, loaded, refresh, placeOrder, cancelOrder, redeem]);

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error('useOrders must be used inside OrdersProvider');
  return ctx;
}
