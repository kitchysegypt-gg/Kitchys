import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from './auth';
import { Rank, nextRank, rankFor } from './loyalty';
import { FREE_DELIVERY_ORDERS, supabase } from './supabase';

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
  total: number;
  points_earned: number;
  voucher_id: string | null;
  address: string | null;
  notes: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  /** Chosen delivery time, or null for as soon as possible. */
  scheduled_for: string | null;
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
  Partial<Pick<Order, 'voucher_id' | 'delivery_lat' | 'delivery_lng' | 'scheduled_for'>>;

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
  rank: Rank;
  next: Rank | undefined;
  refresh: () => Promise<void>;
  placeOrder: (order: NewOrder) => Promise<Order>;
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
    total: Number(row.total),
    points_earned: Number(row.points_earned ?? 0),
  };
}

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!session) {
      setOrders([]);
      setVouchers([]);
      setLoaded(false);
      return;
    }
    setLoading(true);
    const [ordersRes, vouchersRes] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('reward_vouchers').select('*').order('created_at', { ascending: false }),
    ]);
    setLoading(false);
    setLoaded(true);
    if (!ordersRes.error && ordersRes.data) setOrders(ordersRes.data.map(normalize));
    if (!vouchersRes.error && vouchersRes.data) setVouchers(vouchersRes.data as Voucher[]);
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const placeOrder = useCallback(
    async (order: NewOrder) => {
      // Prices, delivery fee, discount and points are all decided by a database trigger.
      const { data, error } = await supabase.from('orders').insert(order).select().single();
      if (error) throw error;
      const created = normalize(data);
      setOrders((prev) => [created, ...prev]);
      if (order.voucher_id) await refresh();
      return created;
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
      redeem,
      orderCount: counted.length,
      points: Math.max(0, earned - spent),
      rank: rankFor(counted.length),
      next: nextRank(counted.length),
      freeDeliveriesLeft: Math.max(0, FREE_DELIVERY_ORDERS - counted.length),
    };
  }, [orders, vouchers, loading, loaded, refresh, placeOrder, redeem]);

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error('useOrders must be used inside OrdersProvider');
  return ctx;
}
