import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, SupabaseClient } from '@supabase/supabase-js';

import { getDish } from '@/data/menu';
import { demoChatReply } from './demoChat';
import type { Language } from './i18n';
import { applyReward, getReward, pointsFor, rankFor } from './loyalty';

/**
 * Offline stand-in for the Supabase client, used only in demo builds
 * (EXPO_PUBLIC_DEMO=1), e.g. the web preview where the real API can't be reached.
 * Any email + password (6+ chars) signs in. Tables live in this browser and follow
 * the same rules as the database (prices, free deliveries, vouchers, points,
 * reviews, chef applications).
 */
const SESSION_KEY = 'kitchys.demo.session';
const TABLE_KEY = (table: string) => `kitchys.demo.db.${table}`;
const DELIVERY_FEE = 30;
const FREE_DELIVERY_ORDERS = 3;

type Row = Record<string, any>;
type Result = { data: any; error: { message: string } | null };
type Listener = (event: string, session: Session | null) => void;

const listeners = new Set<Listener>();
const ok = (data: any): Result => ({ data, error: null });
const fail = (message: string): Result => ({ data: null, error: { message } });
const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

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
  } catch (e: any) {
    // Storage can be unavailable (private windows). A full storage, though, means the
    // change was lost, so say so instead of failing silently.
    if (/quota/i.test(`${e?.name} ${e?.message}`)) {
      throw new Error("The demo's browser storage is full. Try a smaller photo or clear this site's data.");
    }
  }
}

const readTable = (table: string) => readJSON<Row[]>(TABLE_KEY(table), []);
const writeTable = (table: string, rows: Row[]) => writeJSON(TABLE_KEY(table), rows);

// ——— Auth ———

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

const me = () => current?.user.id ?? 'anon';

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
    return { error: null };
  },
  startAutoRefresh() {},
  stopAutoRefresh() {},
};

// ——— Rules that mirror the database ———

async function priceOf(dishId: string) {
  const dish = getDish(dishId);
  if (dish) return { price: dish.price, chefId: dish.chefId };
  const kitchenDish = (await readTable('kitchen_dishes')).find((d) => d.id === dishId && d.available);
  return kitchenDish ? { price: Number(kitchenDish.price), chefId: kitchenDish.chef_id as string } : null;
}

async function insertOrder(values: Row): Promise<Result> {
  const all = await readTable('orders');
  const mine = all.filter((o) => o.user_id === me());
  const vouchers = await readTable('reward_vouchers');
  const items = (values.items ?? []) as { dishId: string; quantity: number }[];
  if (items.length === 0) return fail('Your order is empty');
  if (values.scheduled_for) {
    const t = new Date(values.scheduled_for).getTime();
    if (t < Date.now() - 5 * 60_000 || t > Date.now() + 14 * 86_400_000) {
      return fail('Pick a delivery time within the next 14 days');
    }
  }
  let subtotal = 0;
  for (const item of items) {
    const found = await priceOf(item.dishId);
    if (!found) return fail('One of the dishes is no longer on the menu');
    subtotal += found.price * item.quantity;
  }
  const previous = mine.filter((o) => o.status !== 'cancelled').length;
  let deliveryFee = previous < FREE_DELIVERY_ORDERS ? 0 : DELIVERY_FEE;
  let discount = 0;
  const id = uuid();

  // A friend's referral code only counts on their very first order (checked before anything is changed).
  const referralCode = String(values.referral_code ?? '').trim().toUpperCase() || null;
  let referrer: string | null = null;
  if (referralCode) {
    referrer = (await readTable('referral_codes')).find((c) => c.code === referralCode)?.user_id ?? null;
    if (!referrer) return fail("That referral code doesn't exist");
    if (referrer === me()) return fail("You can't use your own referral code");
    if (mine.length > 0 || (await readTable('referrals')).some((r) => r.friend_id === me())) {
      return fail('Referral codes only work on your first order');
    }
  }

  if (values.voucher_id) {
    const voucher = vouchers.find((v) => v.id === values.voucher_id && v.user_id === me() && v.status === 'available');
    if (!voucher) return fail('That voucher is not available');
    const reward = getReward(voucher.reward_id);
    if (reward?.kind === 'free_delivery' && deliveryFee === 0) {
      return fail('Delivery is already free on this order; keep the voucher for later');
    }
    ({ discount, deliveryFee } = applyReward(reward, subtotal, deliveryFee));
    voucher.status = 'used';
    voucher.order_id = id;
    await writeTable('reward_vouchers', vouchers);
  }
  let total = subtotal - discount + deliveryFee;
  const creditUsed = values.use_credit ? Math.max(0, Math.min(await walletBalance(me()), total)) : 0;
  total -= creditUsed;
  const row: Row = {
    ...values,
    id,
    user_id: me(),
    subtotal,
    discount,
    delivery_fee: deliveryFee,
    total,
    credit_used: creditUsed,
    referral_code: referralCode,
    referred_by: referrer,
    points_earned: pointsFor(subtotal - discount, previous),
    status: 'placed',
    created_at: new Date().toISOString(),
  };
  await writeTable('orders', [row, ...all]);

  const wallet = await readTable('wallet_entries');
  const now = new Date().toISOString();
  if (creditUsed > 0) {
    wallet.unshift({ id: uuid(), user_id: me(), amount: -creditUsed, kind: 'spent', order_id: id, created_at: now });
  }
  if (referrer) {
    const cashback = Math.round((subtotal - discount) * 10) / 100;
    const friendName = (current?.user.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? '';
    await writeTable('referrals', [
      { id: uuid(), referrer_id: referrer, friend_id: me(), order_id: id, cashback, status: 'earned', friend_name: friendName, created_at: now },
      ...(await readTable('referrals')),
    ]);
    if (cashback > 0) {
      wallet.unshift({ id: uuid(), user_id: referrer, amount: cashback, kind: 'referral', order_id: id, created_at: now });
    }
  }
  await writeTable('wallet_entries', wallet);
  return ok(row);
}

async function walletBalance(userId: string) {
  const sum = (await readTable('wallet_entries')).filter((w) => w.user_id === userId).reduce((t, w) => t + w.amount, 0);
  return Math.round(sum * 100) / 100;
}

async function myReferralCode(): Promise<Result> {
  const codes = await readTable('referral_codes');
  const existing = codes.find((c) => c.user_id === me());
  if (existing) return ok(existing.code);
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = 'KIT' + Array.from({ length: 6 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  } while (codes.some((c) => c.code === code));
  await writeTable('referral_codes', [...codes, { user_id: me(), code, created_at: new Date().toISOString() }]);
  return ok(code);
}

async function setKitchenPhoto(url: string | null): Promise<Result> {
  const chefs = await readTable('kitchen_chefs');
  const mine = chefs.find((c) => c.user_id === me());
  if (!mine) return fail('Only approved home chefs have a profile photo');
  mine.photo_url = url;
  await writeTable('kitchen_chefs', chefs);
  return ok(null);
}

async function insertApplication(values: Row): Promise<Result> {
  const all = await readTable('chef_applications');
  if (all.some((a) => a.user_id === me() && ['pending', 'approved'].includes(a.status))) {
    return fail('You already have an application in review or approved');
  }
  const row = {
    ...values,
    id: uuid(),
    user_id: me(),
    email: current?.user.email,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  await writeTable('chef_applications', [row, ...all]);
  return ok(row);
}

async function insertReview(values: Row): Promise<Result> {
  const order = (await readTable('orders')).find((o) => o.id === values.order_id && o.user_id === me());
  if (!order || order.status === 'cancelled') return fail('You can only review your own orders');
  const chefs = await Promise.all((order.items as Row[]).map(async (i) => (await priceOf(i.dishId))?.chefId));
  if (!chefs.includes(values.chef_id)) return fail('This order had no food from that chef');
  const all = await readTable('chef_reviews');
  if (all.some((r) => r.order_id === values.order_id && r.chef_id === values.chef_id)) {
    return fail('You already reviewed this chef for this order');
  }
  const name = (current?.user.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? '';
  const row = { ...values, id: uuid(), user_id: me(), reviewer_name: name, created_at: new Date().toISOString() };
  await writeTable('chef_reviews', [row, ...all]);
  return ok(row);
}

async function ownsKitchenChef(chefId: string) {
  return (await readTable('kitchen_chefs')).some((c) => c.id === chefId && c.user_id === me());
}

async function insertKitchenDish(values: Row): Promise<Result> {
  if (!(await ownsKitchenChef(values.chef_id))) return fail('Not your kitchen');
  const all = await readTable('kitchen_dishes');
  const row = { available: true, ...values, id: uuid(), created_at: new Date().toISOString() };
  await writeTable('kitchen_dishes', [...all, row]);
  return ok(row);
}

async function chefRatings() {
  const byChef = new Map<string, Row[]>();
  for (const r of await readTable('chef_reviews')) byChef.set(r.chef_id, [...(byChef.get(r.chef_id) ?? []), r]);
  const avg = (rows: Row[], f: (r: Row) => number) =>
    Math.round((rows.reduce((s, r) => s + f(r), 0) / rows.length) * 100) / 100;
  return [...byChef.entries()].map(([chef_id, rows]) => ({
    chef_id,
    review_count: rows.length,
    food: avg(rows, (r) => r.food),
    delivery: avg(rows, (r) => r.delivery),
    packaging: avg(rows, (r) => r.packaging),
    value: avg(rows, (r) => r.value),
    overall: avg(rows, (r) => (r.food + r.delivery + r.packaging + r.value) / 4),
  }));
}

/** What a signed-in customer may read from each table (row level security). */
async function visibleRows(table: string): Promise<Row[]> {
  if (table === 'chef_ratings') return chefRatings();
  const rows = await readTable(table);
  if (['orders', 'reward_vouchers', 'chef_applications', 'wallet_entries', 'referral_codes'].includes(table)) {
    return rows.filter((r) => r.user_id === me());
  }
  if (table === 'referrals') return rows.filter((r) => r.referrer_id === me());
  if (table === 'kitchen_dishes') {
    const mine = (await readTable('kitchen_chefs')).filter((c) => c.user_id === me()).map((c) => c.id);
    return rows.filter((r) => r.available || mine.includes(r.chef_id));
  }
  return rows;
}

// ——— A small query builder with the parts of the Supabase API the app uses ———

class DemoQuery implements PromiseLike<Result> {
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private filters: [string, unknown][] = [];
  private sort?: { column: string; ascending: boolean };
  private max?: number;
  private one: 'single' | 'maybe' | null = null;
  private payload: Row | Row[] | null = null;

  constructor(private table: string) {}

  select() {
    return this;
  }
  insert(values: Row | Row[]) {
    this.op = 'insert';
    this.payload = values;
    return this;
  }
  update(values: Row) {
    this.op = 'update';
    this.payload = values;
    return this;
  }
  delete() {
    this.op = 'delete';
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }
  order(column: string, options?: { ascending?: boolean }) {
    this.sort = { column, ascending: options?.ascending ?? true };
    return this;
  }
  limit(n: number) {
    this.max = n;
    return this;
  }
  single() {
    this.one = 'single';
    return this;
  }
  maybeSingle() {
    this.one = 'maybe';
    return this;
  }

  then<A = Result, B = never>(
    onfulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: any) => B | PromiseLike<B>) | null
  ) {
    return this.run().then(onfulfilled, onrejected);
  }

  private matches = (row: Row) => this.filters.every(([c, v]) => row[c] === v);

  private async run(): Promise<Result> {
    if (this.op === 'insert') {
      const values = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
      const results: Row[] = [];
      for (const v of values) {
        const res =
          this.table === 'orders'
            ? await insertOrder(v)
            : this.table === 'chef_applications'
              ? await insertApplication(v)
              : this.table === 'chef_reviews'
                ? await insertReview(v)
                : this.table === 'kitchen_dishes'
                  ? await insertKitchenDish(v)
                  : fail(`Can't write to ${this.table}`);
        if (res.error) return res;
        results.push(res.data);
      }
      return ok(this.one ? results[0] : results);
    }

    if (this.op === 'update' || this.op === 'delete') {
      if (this.table !== 'kitchen_dishes') return fail(`Can't change ${this.table}`);
      const rows = await readTable(this.table);
      const mineChefs = (await readTable('kitchen_chefs')).filter((c) => c.user_id === me()).map((c) => c.id);
      const allowed = (r: Row) => this.matches(r) && mineChefs.includes(r.chef_id);
      const next =
        this.op === 'delete'
          ? rows.filter((r) => !allowed(r))
          : rows.map((r) => (allowed(r) ? { ...r, ...this.payload } : r));
      await writeTable(this.table, next);
      return ok(null);
    }

    let rows = (await visibleRows(this.table)).filter(this.matches);
    if (this.sort) {
      const { column, ascending } = this.sort;
      rows = [...rows].sort(
        (a, b) => (a[column] > b[column] ? 1 : a[column] < b[column] ? -1 : 0) * (ascending ? 1 : -1)
      );
    }
    if (this.max !== undefined) rows = rows.slice(0, this.max);
    if (this.one === 'single') return rows[0] ? ok(rows[0]) : fail('Row not found');
    if (this.one === 'maybe') return ok(rows[0] ?? null);
    return ok(rows);
  }
}

// ——— RPCs and functions ———

async function redeemReward(rewardId: string): Promise<Result> {
  const reward = getReward(rewardId);
  if (!reward) return fail('Unknown reward');
  const orders = (await visibleRows('orders')).filter((o) => o.status !== 'cancelled');
  const all = await readTable('reward_vouchers');
  const mine = all.filter((v) => v.user_id === me());
  if (rankFor(orders.length).level < reward.minRank) return fail('Your rank is too low for this reward');
  const earned = orders.reduce((sum, o) => sum + Number(o.points_earned ?? 0), 0);
  const spent = mine.reduce((sum, v) => sum + Number(v.cost), 0);
  if (earned - spent < reward.cost) return fail('Not enough points');
  const voucher = {
    id: uuid(),
    user_id: me(),
    reward_id: reward.id,
    cost: reward.cost,
    status: 'available',
    order_id: null,
    created_at: new Date().toISOString(),
  };
  await writeTable('reward_vouchers', [voucher, ...all]);
  return ok(voucher);
}

/** In the real app only the Kitchy's team can approve (from the email). The demo lets you try it. */
async function approveApplication(id: string): Promise<Result> {
  const apps = await readTable('chef_applications');
  const app = apps.find((a) => a.id === id);
  if (!app) return fail('Application not found');
  const chefs = await readTable('kitchen_chefs');
  let chef = chefs.find((c) => c.user_id === app.user_id);
  if (!chef) {
    chef = {
      id: uuid(),
      user_id: app.user_id,
      application_id: app.id,
      name: app.full_name,
      area: app.area,
      specialty: app.specialty,
      bio: app.bio ?? '',
      photo_url: app.photo_url ?? null,
      created_at: new Date().toISOString(),
    };
    await writeTable('kitchen_chefs', [...chefs, chef]);
  }
  const dishes = await readTable('kitchen_dishes');
  const added = (app.dishes as Row[]).map((d) => ({
    id: uuid(),
    chef_id: chef!.id,
    name: d.name,
    description: d.description ?? '',
    ingredients: d.ingredients ?? '',
    allergens: d.allergens ?? [],
    category: d.category ?? 'main',
    price: d.price,
    prep_minutes: d.prepMinutes ?? 30,
    serves: d.serves ?? 1,
    spicy: !!d.spicy,
    vegetarian: !!d.vegetarian,
    photo_url: d.photoUrl ?? null,
    portion_grams: d.portionGrams ?? null,
    available: true,
    created_at: new Date().toISOString(),
  }));
  await writeTable('kitchen_dishes', [...dishes, ...added]);
  app.status = 'approved';
  await writeTable('chef_applications', apps);
  return ok(chef.id);
}

async function rpc(name: string, args: Row) {
  if (name === 'redeem_reward') return redeemReward(args.p_reward_id);
  if (name === 'approve_chef_application') return approveApplication(args.p_id);
  if (name === 'my_referral_code') return myReferralCode();
  if (name === 'my_wallet_balance') return ok(await walletBalance(me()));
  if (name === 'set_kitchen_photo') return setKitchenPhoto(args.p_url ?? null);
  return fail(`Unknown function ${name}`);
}

const functions = {
  async invoke(name: string, options: { body: Row }) {
    if (name === 'kitchy-chat') {
      const { messages, language } = options.body as { messages: { content: string }[]; language: Language };
      // Pretend to think for a moment so the typing indicator is visible.
      await new Promise((resolve) => setTimeout(resolve, 900));
      return ok({ reply: demoChatReply(messages[messages.length - 1]?.content ?? '', language) });
    }
    if (name === 'chef-applications') return ok({ emailed: false, reason: 'demo' });
    return fail(`Unknown function ${name}`);
  },
};

export const demoClient = {
  auth,
  from: (table: string) => new DemoQuery(table),
  rpc,
  functions,
} as unknown as SupabaseClient;
