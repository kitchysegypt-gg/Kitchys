import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from './auth';
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
  delivery_fee: number;
  total: number;
  address: string | null;
  notes: string | null;
  status: OrderStatus;
  created_at: string;
};

type NewOrder = Pick<Order, 'items' | 'subtotal' | 'address' | 'notes'>;

type OrdersContextValue = {
  orders: Order[];
  loading: boolean;
  /** True once the first fetch for the current user has finished. */
  loaded: boolean;
  freeDeliveriesLeft: number;
  refresh: () => Promise<void>;
  placeOrder: (order: NewOrder) => Promise<Order>;
};

const OrdersContext = createContext<OrdersContextValue | null>(null);

// Postgres numeric columns arrive as strings.
function normalize(row: any): Order {
  return {
    ...row,
    subtotal: Number(row.subtotal),
    delivery_fee: Number(row.delivery_fee),
    total: Number(row.total),
  };
}

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!session) {
      setOrders([]);
      setLoaded(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    setLoading(false);
    setLoaded(true);
    if (!error && data) setOrders(data.map(normalize));
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const placeOrder = useCallback(async (order: NewOrder) => {
    // Delivery fee and total are calculated by a database trigger (first 3 orders are free).
    const { data, error } = await supabase.from('orders').insert(order).select().single();
    if (error) throw error;
    const created = normalize(data);
    setOrders((prev) => [created, ...prev]);
    return created;
  }, []);

  const value = useMemo(() => {
    const counted = orders.filter((o) => o.status !== 'cancelled').length;
    return {
      orders,
      loading,
      loaded,
      refresh,
      placeOrder,
      freeDeliveriesLeft: Math.max(0, FREE_DELIVERY_ORDERS - counted),
    };
  }, [orders, loading, loaded, refresh, placeOrder]);

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error('useOrders must be used inside OrdersProvider');
  return ctx;
}
