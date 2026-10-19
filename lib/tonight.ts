import { useEffect, useState } from 'react';

import type { Dish } from '@/data/menu';
import { useCatalog } from './catalog';
import { dayHasSlots } from './schedule';

/**
 * Whether tonight's dinner can still be ordered. A dish is out for tonight when its kitchen has
 * no delivery times left today or its daily portions are gone. When every dish near the
 * customer is out, home shows "Sold out tonight, book for tomorrow".
 */
export function useTonight() {
  const { dishes, deals, portionsLeft, lastDelivery } = useCatalog();
  // Re-check every minute so the card appears when the last kitchen closes.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const openTonight = (chefId: string) => dayHasSlots(0, lastDelivery(chefId), now);
  const soldOutTonight = (dish: Dish) => !dish.deal && portionsLeft(dish) === 0;
  const canTonight = (dish: Dish) => openTonight(dish.chefId) && !soldOutTonight(dish);

  const all = [...dishes, ...deals];
  const done = all.length > 0 && !all.some(canTonight);
  // Closed when no kitchen near the customer delivers any more today; otherwise it sold out.
  const reason: 'closed' | 'soldOut' | null = !done ? null : all.some((d) => openTonight(d.chefId)) ? 'soldOut' : 'closed';

  return { done, reason, soldOutTonight, canTonight };
}
