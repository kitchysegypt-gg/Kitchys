import type { EmojiName } from './emoji';
import type { TranslationKey } from './i18n';

/**
 * Loyalty rules. The database (supabase/migrations/*_loyalty.sql) enforces the
 * same numbers; keep both in sync when changing them.
 */

/** Points are earned per this many EGP spent (after discounts, before delivery). */
export const EGP_PER_POINT = 10;

export type RankId = 'starter' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export type Rank = {
  id: RankId;
  level: number;
  minOrders: number;
  /** Points multiplier for orders placed at this rank. */
  multiplier: number;
  emoji: EmojiName;
  color: string;
};

export const RANKS: Rank[] = [
  { id: 'starter', level: 0, minOrders: 0, multiplier: 1, emoji: 'seedling', color: '#8BC34A' },
  { id: 'bronze', level: 1, minOrders: 3, multiplier: 1.1, emoji: 'medal_bronze', color: '#CD7F32' },
  { id: 'silver', level: 2, minOrders: 10, multiplier: 1.25, emoji: 'medal_silver', color: '#9EA7B3' },
  { id: 'gold', level: 3, minOrders: 25, multiplier: 1.5, emoji: 'medal_gold', color: '#F5B301' },
  { id: 'platinum', level: 4, minOrders: 50, multiplier: 1.75, emoji: 'crown', color: '#7E8CE0' },
  { id: 'diamond', level: 5, minOrders: 100, multiplier: 2, emoji: 'gem', color: '#26C6DA' },
];

export function rankFor(orderCount: number): Rank {
  return [...RANKS].reverse().find((r) => orderCount >= r.minOrders) ?? RANKS[0];
}

export function nextRank(orderCount: number): Rank | undefined {
  return RANKS.find((r) => r.minOrders > orderCount);
}

/** Points for an order, given how many orders the customer had placed before it. */
export function pointsFor(amountAfterDiscount: number, previousOrders: number): number {
  return Math.floor((amountAfterDiscount / EGP_PER_POINT) * rankFor(previousOrders).multiplier);
}

export type RewardKind = 'free_delivery' | 'fixed' | 'percent';

export type Reward = {
  id: string;
  kind: RewardKind;
  /** EGP off for `fixed`, percent for `percent`, unused for `free_delivery`. */
  value: number;
  /** Cap in EGP for `percent` rewards. */
  maxDiscount?: number;
  cost: number;
  minRank: number;
  emoji: EmojiName;
  label: TranslationKey;
};

// Deliberately pricey: at 1 point per EGP 10, a typical EGP 250 order earns ~25 points.
export const REWARDS: Reward[] = [
  {
    id: 'free_delivery',
    kind: 'free_delivery',
    value: 0,
    cost: 80,
    minRank: 0,
    emoji: 'truck',
    label: 'rw_free_delivery',
  },
  { id: 'off_25', kind: 'fixed', value: 25, cost: 100, minRank: 0, emoji: 'coin', label: 'rw_off_25' },
  {
    id: 'pct_10',
    kind: 'percent',
    value: 10,
    maxDiscount: 60,
    cost: 150,
    minRank: 1,
    emoji: 'ticket',
    label: 'rw_pct_10',
  },
  { id: 'off_50', kind: 'fixed', value: 50, cost: 180, minRank: 1, emoji: 'money', label: 'rw_off_50' },
  {
    id: 'pct_20',
    kind: 'percent',
    value: 20,
    maxDiscount: 120,
    cost: 300,
    minRank: 2,
    emoji: 'money_wings',
    label: 'rw_pct_20',
  },
  { id: 'off_100', kind: 'fixed', value: 100, cost: 350, minRank: 2, emoji: 'gift', label: 'rw_off_100' },
  {
    id: 'pct_30',
    kind: 'percent',
    value: 30,
    maxDiscount: 200,
    cost: 600,
    minRank: 3,
    emoji: 'trophy',
    label: 'rw_pct_30',
  },
];

export const getReward = (id: string) => REWARDS.find((r) => r.id === id);

/** How much a reward takes off an order. Mirrors the database trigger. */
export function applyReward(reward: Reward | undefined, subtotal: number, deliveryFee: number) {
  if (!reward) return { discount: 0, deliveryFee };
  switch (reward.kind) {
    case 'free_delivery':
      return { discount: 0, deliveryFee: 0 };
    case 'fixed':
      return { discount: Math.min(reward.value, subtotal), deliveryFee };
    case 'percent':
      return {
        discount: Math.min(Math.round((subtotal * reward.value) / 100), reward.maxDiscount ?? Infinity),
        deliveryFee,
      };
  }
}
