import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, SupabaseClient } from '@supabase/supabase-js';

import { getDish } from '@/data/menu';
import { demoChatReply } from './demoChat';
import type { Language } from './i18n';
import { applyReward, getReward, pointsFor, rankFor } from './loyalty';

/**
 * Offline stand-in for the Supabase client, used only in demo builds
 * (EXPO_PUBLIC_DEMO=1), e.g. the web preview where the real API can't be reached.
 * Any email + password (6+ chars) signs in; orders are kept on the device and
 * priced with the same rule as the database trigger (first 3 deliveries free).
 */
const SESSION_KEY = 'kitchys.demo.session';
const ORDERS_KEY = 'kitchys.demo.orders';
const VOUCHERS_KEY = 'kitchys.demo.vouchers';
const DELIVERY_FEE = 30;
const FREE_DELIVERY_ORDERS = 3;

type Listener = (event: string, session: Session | null) => void;
const listeners = new Set<Listener>();

async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJSON(key: string, value: unknown) {
  try {
    if (value === null) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private windows); the demo still works in memory.
  }
}

let current: Session | null = null;
let restored = false;

function makeSession(email: string, fullName?: string): Session {
  return {
    access_token: 'demo',
    refresh_token: 'demo',
    token_type: 'bearer',
    expires_in: 60 * 60 * 24 * 365,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
    user: {
      id: 'demo-' + email.toLowerCase(),
      aud: 'authenticated',
      email,
      app_metadata: {},
      user_metadata: fullName ? { full_name: fullName } : {},
      created_at: new Date().toISOString(),
    },
  } as Session;
}

async function setSession(session: Session | null, event: string) {
  current = session;
  await writeJSON(SESSION_KEY, session);
  listeners.forEach((l) => l(event, session));
}

const ok = { error: null };

const auth = {
  async getSession() {
    if (!restored) {
      current = await readJSON<Session | null>(SESSION_KEY, null);
      restored = true;
    }
    return { data: { session: current }, error: null };
  },
  onAuthStateChange(cb: Listener) {
    listeners.add(cb);
    return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
  },
  async signInWithPassword({ email }: { email: string; password: string }) {
    const session = makeSession(email);
    await setSession(session, 'SIGNED_IN');
    return { data: { session, user: session.user }, error: null };
  },
  async signUp({ email, options }: { email: string; password: string; options?: { data?: { full_name?: string } } }) {
    const session = makeSession(email, options?.data?.full_name);
    await setSession(session, 'SIGNED_IN');
    return { data: { session, user: session.user }, error: null };
  },
  async signOut() {
    await setSession(null, 'SIGNED_OUT');
    return ok;
  },
  startAutoRefresh() {},
  stopAutoRefresh() {},
};

type Row = Record<string, any>;

const key = (table: string) => `${table === 'orders' ? ORDERS_KEY : VOUCHERS_KEY}.${current?.user.id ?? 'anon'}`;
const fail = (message: string) => ({ data: null, error: { message } });

/** Same pricing as the database trigger: server prices, free first 3 deliveries, voucher, points. */
async function placeDemoOrder(values: Row) {
  const orders = await readJSON<Row[]>(key('orders'), []);
  const vouchers = await readJSON<Row[]>(key('reward_vouchers'), []);
  const items = (values.items ?? []) as { dishId: string; quantity: number }[];
  if (items.length === 0) return fail('Your order is empty');
  let subtotal = 0;
  for (const item of items) {
    const dish = getDish(item.dishId);
    if (!dish) return fail('One of the dishes is no longer on the menu');
    subtotal += dish.price * item.quantity;
  }
  const previous = orders.filter((o) => o.status !== 'cancelled').length;
  let deliveryFee = previous < FREE_DELIVERY_ORDERS ? 0 : DELIVERY_FEE;
  let discount = 0;
  const id = `demo-${Date.now()}`;
  if (values.voucher_id) {
    const voucher = vouchers.find((v) => v.id === values.voucher_id && v.status === 'available');
    if (!voucher) return fail('That voucher is not available');
    const reward = getReward(voucher.reward_id);
    if (reward?.kind === 'free_delivery' && deliveryFee === 0) {
      return fail('Delivery is already free on this order; keep the voucher for later');
    }
    ({ discount, deliveryFee } = applyReward(reward, subtotal, deliveryFee));
    voucher.status = 'used';
    voucher.order_id = id;
    await writeJSON(key('reward_vouchers'), vouchers);
  }
  const row: Row = {
    ...values,
    id,
    subtotal,
    discount,
    delivery_fee: deliveryFee,
    total: subtotal - discount + deliveryFee,
    points_earned: pointsFor(subtotal - discount, previous),
    status: 'placed',
    created_at: new Date().toISOString(),
  };
  await writeJSON(key('orders'), [row, ...orders]);
  return { data: row, error: null };
}

async function redeemDemoReward(rewardId: string) {
  const reward = getReward(rewardId);
  if (!reward) return fail('Unknown reward');
  const orders = (await readJSON<Row[]>(key('orders'), [])).filter((o) => o.status !== 'cancelled');
  const vouchers = await readJSON<Row[]>(key('reward_vouchers'), []);
  if (rankFor(orders.length).level < reward.minRank) return fail('Your rank is too low for this reward');
  const earned = orders.reduce((sum, o) => sum + Number(o.points_earned ?? 0), 0);
  const spent = vouchers.reduce((sum, v) => sum + Number(v.cost), 0);
  if (earned - spent < reward.cost) return fail('Not enough points');
  const voucher = {
    id: `demo-v-${Date.now()}`,
    reward_id: reward.id,
    cost: reward.cost,
    status: 'available',
    order_id: null,
    created_at: new Date().toISOString(),
  };
  await writeJSON(key('reward_vouchers'), [voucher, ...vouchers]);
  return { data: voucher, error: null };
}

function from(table: 'orders' | 'reward_vouchers') {
  return {
    select() {
      return {
        async order() {
          return { data: await readJSON<Row[]>(key(table), []), error: null };
        },
      };
    },
    insert(values: Row) {
      return { select: () => ({ single: () => placeDemoOrder(values) }) };
    },
  };
}

async function rpc(name: string, args: { p_reward_id: string }) {
  if (name === 'redeem_reward') return redeemDemoReward(args.p_reward_id);
  return fail(`Unknown function ${name}`);
}

const functions = {
  async invoke(name: string, options: { body: { messages: { role: string; content: string }[]; language: string } }) {
    if (name !== 'kitchy-chat') return fail(`Unknown function ${name}`);
    const { messages, language } = options.body;
    const question = messages[messages.length - 1]?.content ?? '';
    // Pretend to think for a moment so the typing indicator is visible.
    await new Promise((resolve) => setTimeout(resolve, 900));
    return { data: { reply: demoChatReply(question, language as Language) }, error: null };
  },
};

export const demoClient = { auth, from, rpc, functions } as unknown as SupabaseClient;
