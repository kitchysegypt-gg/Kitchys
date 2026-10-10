import { useEffect, useState } from 'react';

import { supabase } from './supabase';

/** The rider bringing an order. Location only while the order is on the way. */
export type OrderRider = {
  order_id: string;
  name: string;
  phone: string;
  vehicle: string;
  latitude: number | null;
  longitude: number | null;
  located_at: string | null;
};

/**
 * Who is delivering these orders (customers see their own, chefs their kitchen's).
 * Re-checked every 30 seconds so the rider's position stays fresh.
 */
export function useOrderRiders(orderIds: string[]) {
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
    const timer = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [key]);

  return riders;
}

/** Google Maps at a point (rider, kitchen or customer). */
export const mapsLink = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
