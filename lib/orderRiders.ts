import { useEffect, useState } from 'react';

import { supabase } from './supabase';

/**
 * The rider bringing an order. The position only comes once the order is live: on the
 * way and the rider about 5 minutes from the customer (customers only, never chefs).
 */
export type OrderRider = {
  order_id: string;
  name: string;
  phone: string;
  vehicle: string;
  latitude: number | null;
  longitude: number | null;
  located_at: string | null;
  /** Minutes until the rider reaches the customer, while on the way. */
  eta_minutes: number | null;
  /** True once the customer can follow the rider on the map. */
  live: boolean;
};

/**
 * Who is delivering these orders (customers see their own, chefs their kitchen's).
 * Re-checked every 30 seconds (or `everyMs`) so the rider's position stays fresh.
 */
export function useOrderRiders(orderIds: string[], everyMs = 30_000) {
  const [riders, setRiders] = useState<Record<string, OrderRider>>({});
  const key = [...orderIds].sort().join(',');

  useEffect(() => {
    const ids = key ? key.split(',') : [];
    if (!ids.length) {
      setRiders({});
      return;
    }
    let alive = true;
    const load = async () => {
      const { data, error } = await supabase.rpc('order_riders', { p_orders: ids });
      if (!alive || error || !Array.isArray(data)) return;
      setRiders(Object.fromEntries((data as OrderRider[]).map((r) => [r.order_id, r])));
    };
    load();
    const timer = setInterval(load, everyMs);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [key, everyMs]);

  return riders;
}

/** Google Maps at a point (rider, kitchen or customer). */
export const mapsLink = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
