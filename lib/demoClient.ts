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
const SERVICE_FEE = 20;
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
  if (kitchenDish) return { price: Number(kitchenDish.price), chefId: kitchenDish.chef_id as string };
  const deal = (await readTable('dish_deals')).find(
    (d) => d.id === dishId && !d.cancelled && new Date(d.expires_at) > new Date() && d.sold < d.quantity
  );
  return deal ? { price: Number(deal.price), chefId: deal.chef_id as string } : null;
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
  let chefId: string | null = null;
  for (const item of items) {
    const found = await priceOf(item.dishId);
    if (!found) return fail('One of the dishes is no longer on the menu');
    subtotal += found.price * item.quantity;
    chefId = found.chefId;
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
  const serviceFee = SERVICE_FEE;
  let total = subtotal - discount + deliveryFee + serviceFee;
  const creditUsed = values.use_credit ? Math.max(0, Math.min(await walletBalance(me()), total)) : 0;
  total -= creditUsed;
  const row: Row = {
    ...values,
    id,
    user_id: me(),
    subtotal,
    discount,
    delivery_fee: deliveryFee,
    service_fee: serviceFee,
    total,
    credit_used: creditUsed,
    referral_code: referralCode,
    referred_by: referrer,
    points_earned: pointsFor(subtotal - discount, previous),
    status: 'placed',
    chef_id: chefId,
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

// Where the menu chefs cook (the real database keeps these private in chef_locations).
const MENU_CHEF_LOCATIONS: Row[] = [
  { chef_id: 'fatma', latitude: 30.088, longitude: 31.245 },
  { chef_id: 'samira', latitude: 31.205, longitude: 29.882 },
  { chef_id: 'mona', latitude: 30.056, longitude: 31.33 },
  { chef_id: 'hoda', latitude: 30.091, longitude: 31.322 },
  { chef_id: 'nour', latitude: 29.96, longitude: 31.257 },
];
const DEMO_RADIUS_KM = 15;

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

async function saveChefLocation(chefId: string, latitude: number, longitude: number) {
  const rows = (await readTable('chef_locations')).filter((r) => r.chef_id !== chefId);
  await writeTable('chef_locations', [...rows, { chef_id: chefId, latitude, longitude }]);
}

async function chefsNear(lat: number, lng: number): Promise<Result> {
  const all = [...MENU_CHEF_LOCATIONS, ...(await readTable('chef_locations'))];
  return ok(all.filter((r) => distanceKm(lat, lng, r.latitude, r.longitude) <= DEMO_RADIUS_KM).map((r) => r.chef_id));
}

async function myKitchen() {
  return (await readTable('kitchen_chefs')).find((c) => c.user_id === me());
}

async function setKitchenLocation(lat: number, lng: number): Promise<Result> {
  const mine = await myKitchen();
  if (!mine) return fail('Only approved home chefs have a kitchen');
  await saveChefLocation(mine.id, lat, lng);
  return ok(null);
}

async function myKitchenLocation(): Promise<Result> {
  const mine = await myKitchen();
  const row = mine && (await readTable('chef_locations')).find((r) => r.chef_id === mine.id);
  return ok(row ? [{ latitude: row.latitude, longitude: row.longitude }] : []);
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
  if (table === 'orders') {
    const kitchen = await myKitchen();
    return rows.filter((r) => r.user_id === me() || (kitchen && r.chef_id === kitchen.id));
  }
  if (['reward_vouchers', 'chef_applications', 'wallet_entries', 'referral_codes'].includes(table)) {
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
  private ranges: ((row: Row) => boolean)[] = [];
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
  gt(column: string, value: string | number) {
    this.ranges.push((row) => row[column] > value);
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

  private matches = (row: Row) => this.filters.every(([c, v]) => row[c] === v) && this.ranges.every((test) => test(row));

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
  if (typeof app.kitchen_lat === 'number' && typeof app.kitchen_lng === 'number') {
    await saveChefLocation(chef.id, app.kitchen_lat, app.kitchen_lng);
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
    photo_urls: d.photoUrls ?? (d.photoUrl ? [d.photoUrl] : []),
    portion_grams: d.portionGrams ?? null,
    available: true,
    created_at: new Date().toISOString(),
  }));
  await writeTable('kitchen_dishes', [...dishes, ...added]);
  app.status = 'approved';
  await writeTable('chef_applications', apps);
  return ok(chef.id);
}

async function setLastDelivery(minutes: number) {
  const chef = await myKitchen();
  if (!chef) return fail('Only approved home chefs have a kitchen');
  const rows = (await readTable('chef_hours')).filter((r) => r.chef_id !== chef.id);
  await writeTable('chef_hours', [...rows, { chef_id: chef.id, last_delivery_minutes: minutes }]);
  return ok(null);
}

async function setKitchenPaused(paused: boolean) {
  const chef = await myKitchen();
  if (!chef) return fail('Only approved home chefs have a kitchen');
  const rows = await readTable('chef_hours');
  const row = rows.find((r) => r.chef_id === chef.id);
  if (row) row.paused = paused;
  else rows.push({ chef_id: chef.id, last_delivery_minutes: 1260, paused });
  await writeTable('chef_hours', rows);
  return ok(null);
}

const NEXT_STATUS: Record<string, string[]> = {
  placed: ['cooking', 'cancelled'],
  cooking: ['ready', 'cancelled'],
  ready: ['cancelled'],
};

async function chefSetOrderStatus(orderId: string, status: string) {
  const chef = await myKitchen();
  if (!chef) return fail('Only approved home chefs have a kitchen');
  const all = await readTable('orders');
  const order = all.find((o) => o.id === orderId && o.chef_id === chef.id);
  if (!order) return fail('Order not found');
  if (status === 'accepted') {
    if (order.status !== 'placed') return fail('Only new orders can be accepted');
    order.accepted_at ??= new Date().toISOString();
    await writeTable('orders', all);
    return ok(null);
  }
  if (!(NEXT_STATUS[order.status] ?? []).includes(status)) return fail(`This order can't go from ${order.status} to ${status}`);
  if (status === 'cooking' && order.scheduled_for && new Date(order.scheduled_for).toDateString() !== new Date().toDateString() && new Date(order.scheduled_for) > new Date()) {
    return fail('You can start cooking on the delivery day.');
  }
  order.status = status;
  if (status === 'cooking') order.accepted_at ??= new Date().toISOString();
  if (status === 'ready') order.ready_at = new Date().toISOString();
  await writeTable('orders', all);
  return ok(null);
}

/** The kitchen's orders, without the customer's address, location or phone (like the real RPC). */
async function kitchenOrders() {
  const chef = await myKitchen();
  if (!chef) return ok([]);
  const rows = (await readTable('orders'))
    .filter((o) => o.chef_id === chef.id)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 100);
  return ok(
    rows.map(({ id, items, subtotal, notes, status, created_at, scheduled_for, accepted_at, rider_id }) => ({
      id,
      items,
      subtotal,
      notes,
      status,
      created_at,
      scheduled_for: scheduled_for ?? null,
      accepted_at: accepted_at ?? null,
      rider_id: rider_id ?? null,
    }))
  );
}

async function replyToReview(reviewId: string, reply: string) {
  const chef = await myKitchen();
  if (!chef) return fail('Only approved home chefs have a kitchen');
  const all = await readTable('chef_reviews');
  const review = all.find((r) => r.id === reviewId && r.chef_id === chef.id);
  if (!review) return fail('Review not found');
  review.chef_reply = reply.trim() || null;
  await writeTable('chef_reviews', all);
  return ok(null);
}

/** The same numbers as the kitchen_stats database function, worked out in the browser. */
async function myKitchenStats(days: number) {
  const chef = await myKitchen();
  if (!chef) return fail('Only approved home chefs have a kitchen');
  const dayOf = (o: Row) => new Date(o.scheduled_for ?? o.created_at).toISOString().slice(0, 10);
  const all = (await readTable('orders')).filter((o) => o.chef_id === chef.id);
  const live = all.filter((o) => o.status !== 'cancelled');
  const today = new Date().toISOString().slice(0, 10);
  const dayList = Array.from({ length: days }, (_, i) => new Date(Date.now() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10));
  const inWin = live.filter((o) => dayOf(o) >= dayList[0] && dayOf(o) <= today);
  const sum = (rows: Row[]) => rows.reduce((s, o) => s + Number(o.subtotal), 0);
  const dishes: Record<string, { dish_id: string; name: string; qty: number; sales: number }> = {};
  for (const o of inWin) {
    for (const item of o.items as { dishId: string; name: string; price: number; quantity: number }[]) {
      const d = (dishes[item.dishId] ??= { dish_id: item.dishId, name: item.name, qty: 0, sales: 0 });
      d.qty += item.quantity;
      d.sales += item.price * item.quantity;
    }
  }
  const byUser: Record<string, number> = {};
  inWin.forEach((o) => (byUser[o.user_id] = (byUser[o.user_id] ?? 0) + 1));
  const reviews = (await readTable('chef_reviews')).filter((r) => r.chef_id === chef.id);
  const avg = (key: string) => (reviews.length ? reviews.reduce((s, r) => s + r[key], 0) / reviews.length : null);
  const hours: Record<number, number> = {};
  inWin.forEach((o) => {
    const h = new Date(o.scheduled_for ?? o.created_at).getHours();
    hours[h] = (hours[h] ?? 0) + 1;
  });
  return ok({
    days,
    today: {
      orders: live.filter((o) => dayOf(o) === today).length,
      sales: sum(live.filter((o) => dayOf(o) === today)),
      open: all.filter((o) => ['placed', 'cooking', 'on_the_way'].includes(o.status)).length,
    },
    orders: inWin.length,
    sales: sum(inWin),
    prev_orders: 0,
    prev_sales: 0,
    average_order: inWin.length ? Math.round(sum(inWin) / inWin.length) : 0,
    customers: Object.keys(byUser).length,
    repeat_customers: Object.values(byUser).filter((n) => n > 1).length,
    cancelled: all.filter((o) => o.status === 'cancelled').length,
    by_day: dayList.map((day) => {
      const rows = inWin.filter((o) => dayOf(o) === day);
      return { day, orders: rows.length, sales: sum(rows) };
    }),
    by_weekday: Array.from({ length: 7 }, (_, wd) => ({
      weekday: wd,
      orders: inWin.filter((o) => new Date(dayOf(o)).getDay() === wd).length,
    })),
    by_hour: Object.entries(hours).map(([hour, orders]) => ({ hour: Number(hour), orders })),
    top_dishes: Object.values(dishes).sort((a, b) => b.qty - a.qty).slice(0, 5),
    rating: {
      count: reviews.length,
      overall: reviews.length ? ((avg('food') ?? 0) + (avg('delivery') ?? 0) + (avg('packaging') ?? 0) + (avg('value') ?? 0)) / 4 : null,
      food: avg('food'),
      delivery: avg('delivery'),
      packaging: avg('packaging'),
      value: avg('value'),
      recent: null,
      unanswered: reviews.filter((r) => r.comment && !r.chef_reply).length,
    },
  });
}

async function cancelMyOrder(orderId: string) {
  const all = await readTable('orders');
  const order = all.find((o) => o.id === orderId && o.user_id === me());
  if (!order) return fail('Order not found');
  if (order.status !== 'placed') return fail("The chef already started cooking this order, so it can't be cancelled.");
  order.status = 'cancelled';
  order.cancelled_by = 'customer';
  await writeTable('orders', all);
  return ok(null);
}

async function startDeal(dishId: string, price: number, quantity: number) {
  const chef = await myKitchen();
  if (!chef) return fail('Only approved home chefs have a kitchen');
  const dish = (await readTable('kitchen_dishes')).find((d) => d.id === dishId && d.chef_id === chef.id);
  if (!dish) return fail('Dish not found');
  if (!(price > 0) || price >= Number(dish.price)) return fail(`The deal price must be lower than the usual price (EGP ${dish.price}).`);
  const ends = new Date();
  ends.setHours(21, 0, 0, 0);
  if (ends <= new Date()) ends.setTime(Date.now() + 2 * 3600_000);
  const rows = (await readTable('dish_deals')).map((d) => (d.dish_id === dishId ? { ...d, cancelled: true } : d));
  rows.push({ id: uuid(), chef_id: chef.id, dish_id: dishId, price, quantity, sold: 0, cancelled: false, expires_at: ends.toISOString() });
  await writeTable('dish_deals', rows);
  return ok(null);
}

async function endDeal(dealId: string) {
  const rows = (await readTable('dish_deals')).map((d) => (d.id === dealId ? { ...d, cancelled: true } : d));
  await writeTable('dish_deals', rows);
  return ok(null);
}

/** Orders and best-selling dish per kitchen, like the chef_highlights database function. */
async function chefHighlights() {
  const deals = await readTable('dish_deals');
  const base = (id: string) => deals.find((d) => d.id === id)?.dish_id ?? id;
  const live = (await readTable('orders')).filter((o) => o.status !== 'cancelled' && o.chef_id);
  const byChef: Record<string, { orders: number; qty: Record<string, number> }> = {};
  for (const o of live) {
    const c = (byChef[o.chef_id] ??= { orders: 0, qty: {} });
    c.orders += 1;
    for (const item of o.items as { dishId: string; quantity: number }[]) {
      c.qty[base(item.dishId)] = (c.qty[base(item.dishId)] ?? 0) + item.quantity;
    }
  }
  return ok(
    Object.entries(byChef).map(([chef_id, c]) => ({
      chef_id,
      orders: c.orders,
      top_dish: Object.entries(c.qty).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    }))
  );
}

/** Portions per dish over the last 30 days, like the popular_dishes database function. */
async function popularDishes() {
  const deals = await readTable('dish_deals');
  const since = Date.now() - 30 * 86_400_000;
  const qty: Record<string, number> = {};
  for (const o of await readTable('orders')) {
    if (o.status === 'cancelled' || new Date(o.created_at).getTime() < since) continue;
    for (const item of o.items as { dishId: string; quantity: number }[]) {
      const id = deals.find((d) => d.id === item.dishId)?.dish_id ?? item.dishId;
      qty[id] = (qty[id] ?? 0) + item.quantity;
    }
  }
  return ok(
    Object.entries(qty)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([dish_id, portions]) => ({ dish_id, portions }))
  );
}

/** Orders per dish over the last 7 days, like the dish_week_orders database function. */
async function dishWeekOrders() {
  const deals = await readTable('dish_deals');
  const since = Date.now() - 7 * 86_400_000;
  const orders: Record<string, Set<string>> = {};
  for (const o of await readTable('orders')) {
    if (o.status === 'cancelled' || new Date(o.created_at).getTime() < since) continue;
    for (const item of o.items as { dishId: string }[]) {
      const id = deals.find((d) => d.id === item.dishId)?.dish_id ?? item.dishId;
      (orders[id] ??= new Set()).add(o.id);
    }
  }
  return ok(Object.entries(orders).map(([dish_id, ids]) => ({ dish_id, orders: ids.size })));
}

// ---- Kitchy's Rider (demo) --------------------------------------------------------------
async function myRider() {
  return (await readTable('riders')).find((r) => r.user_id === me());
}

async function riderStatus() {
  const rider = await myRider();
  if (rider) return ok({ status: 'approved', rider });
  const app = (await readTable('rider_applications')).filter((a) => a.user_id === me()).pop();
  return ok({ status: app?.status ?? 'none' });
}

async function riderApply(args: Row) {
  const apps = await readTable('rider_applications');
  const id = `ra-${Date.now()}`;
  apps.push({ id, user_id: me(), full_name: args.p_name, phone: args.p_phone, vehicle: args.p_vehicle, area: args.p_area, status: 'pending' });
  await writeTable('rider_applications', apps);
  return ok(id);
}

async function riderOrderJson(o: Row, full: boolean) {
  const chef = (await readTable('kitchen_chefs')).find((c) => c.id === o.chef_id);
  return {
    id: o.id,
    status: o.status,
    scheduled_for: o.scheduled_for ?? null,
    created_at: o.created_at,
    ready_at: o.ready_at ?? null,
    items: (o.items as { quantity: number }[]).reduce((n, i) => n + i.quantity, 0),
    cash: Number(o.total ?? o.subtotal),
    delivery_fee: Number(o.delivery_fee ?? 0),
    chef: { name: chef?.name ?? '', area: chef?.area ?? null, lat: 30.04, lng: 31.23, phone: full ? '01000000000' : null },
    customer: {
      name: full ? 'Omar' : null,
      phone: full ? (o.phone ?? '01111111111') : null,
      address: full ? o.address : null,
      notes: full ? o.notes : null,
      lat: o.delivery_lat ?? 30.05,
      lng: o.delivery_lng ?? 31.24,
    },
    to_kitchen_km: 2.4,
    trip_km: 3.1,
  };
}

/**
 * The demo rider rides towards the customer: about 9 minutes away when picked up, one
 * minute closer every 20 seconds, live on the map from 5 minutes.
 */
async function orderRiders(ids: string[]) {
  const riders = await readTable('riders');
  const rows = (await readTable('orders')).filter(
    (o) => ids.includes(o.id) && o.rider_id && ['cooking', 'ready', 'on_the_way'].includes(o.status)
  );
  return ok(
    rows.map((o) => {
      const rider = riders.find((r) => r.id === o.rider_id);
      const home = { lat: Number(o.delivery_lat ?? 30.05), lng: Number(o.delivery_lng ?? 31.24) };
      const since = o.picked_up_at ? (Date.now() - new Date(o.picked_up_at).getTime()) / 20_000 : 0;
      const eta = Math.max(1, Math.round(9 - since));
      const live = o.status === 'on_the_way' && eta <= 5;
      // 1 minute ≈ 0.0028° (about 300 m), coming from the north-west.
      const away = (eta - 1) * 0.0028;
      return {
        order_id: o.id,
        name: rider?.name ?? 'Mahmoud',
        phone: rider?.phone ?? '01000000000',
        vehicle: rider?.vehicle ?? 'motorbike',
        latitude: live ? home.lat + away * 0.8 : null,
        longitude: live ? home.lng - away * 0.6 : null,
        located_at: live ? new Date().toISOString() : null,
        eta_minutes: o.status === 'on_the_way' ? eta : null,
        live,
      };
    })
  );
}

async function riderOrders(mine: boolean) {
  const rider = await myRider();
  if (!rider) return ok([]);
  const rows = (await readTable('orders')).filter((o) =>
    mine
      ? o.rider_id === rider.id && ['cooking', 'ready', 'on_the_way', 'delivered'].includes(o.status)
      : rider.online && !o.rider_id && ['cooking', 'ready'].includes(o.status)
  );
  return ok(await Promise.all(rows.map((o) => riderOrderJson(o, mine))));
}

async function riderUpdate(orderId: string, change: (o: Row, riderId: string) => string | null) {
  const rider = await myRider();
  if (!rider) return fail('Only approved riders can take orders');
  const all = await readTable('orders');
  const order = all.find((o) => o.id === orderId);
  if (!order) return fail('Order not found');
  const error = change(order, rider.id);
  if (error) return fail(error);
  await writeTable('orders', all);
  return ok(null);
}

async function riderSetOnline(online: boolean) {
  const riders = await readTable('riders');
  const rider = riders.find((r) => r.user_id === me());
  if (!rider) return fail('Only approved riders can go online');
  rider.online = online;
  await writeTable('riders', riders);
  return ok(null);
}

async function riderStats() {
  const rider = await myRider();
  const done = (await readTable('orders')).filter((o) => rider && o.rider_id === rider.id && o.status === 'delivered');
  const cash = done.reduce((n, o) => n + Number(o.total ?? o.subtotal), 0);
  const today = new Date().toISOString().slice(0, 10);
  return ok({
    deliveries: done.length,
    cash,
    delivery_fees: 0,
    today_deliveries: done.length,
    today_cash: cash,
    by_day: done.length ? [{ day: today, deliveries: done.length, cash }] : [],
  });
}

async function rpc(name: string, args: Row) {
  if (name === 'my_rider_status') return riderStatus();
  if (name === 'submit_rider_application') return riderApply(args);
  if (name === 'rider_set_online') return riderSetOnline(Boolean(args.p_online));
  if (name === 'rider_update_location') return ok(null);
  if (name === 'rider_available_orders') return riderOrders(false);
  if (name === 'rider_my_orders') return riderOrders(true);
  if (name === 'rider_stats') return riderStats();
  if (name === 'rider_claim_order')
    return riderUpdate(args.p_order, (o, riderId) => {
      if (o.rider_id) return 'Another rider already took this order';
      o.rider_id = riderId;
      return null;
    });
  if (name === 'rider_release_order')
    return riderUpdate(args.p_order, (o) => {
      o.rider_id = null;
      return null;
    });
  if (name === 'rider_set_order_status')
    return riderUpdate(args.p_order, (o) => {
      if (args.p_step === 'picked_up') Object.assign(o, { status: 'on_the_way', picked_up_at: new Date().toISOString() });
      else if (args.p_step === 'delivered') o.status = 'delivered';
      return null;
    });
  if (name === 'chef_highlights') return chefHighlights();
  if (name === 'order_riders') return orderRiders(args.p_orders ?? []);
  if (name === 'my_last_phone') return ok(null);
  if (name === 'kitchen_orders') return kitchenOrders();
  if (name === 'popular_dishes') return popularDishes();
  if (name === 'dish_week_orders') return dishWeekOrders();
  if (name === 'redeem_reward') return redeemReward(args.p_reward_id);
  if (name === 'approve_chef_application') return approveApplication(args.p_id);
  if (name === 'my_referral_code') return myReferralCode();
  if (name === 'my_wallet_balance') return ok(await walletBalance(me()));
  if (name === 'set_kitchen_photo') return setKitchenPhoto(args.p_url ?? null);
  if (name === 'chefs_near') return chefsNear(args.p_lat, args.p_lng);
  if (name === 'chef_popularity') return ok([]);
  if (name === 'set_kitchen_location') return setKitchenLocation(args.p_lat, args.p_lng);
  if (name === 'my_kitchen_location') return myKitchenLocation();
  if (name === 'set_last_delivery') return setLastDelivery(args.p_minutes);
  if (name === 'set_kitchen_paused') return setKitchenPaused(Boolean(args.p_paused));
  if (name === 'chef_set_order_status') return chefSetOrderStatus(args.p_order, args.p_status);
  if (name === 'reply_to_review') return replyToReview(args.p_review, args.p_reply ?? '');
  if (name === 'my_kitchen_stats') return myKitchenStats(Number(args.p_days) || 7);
  if (name === 'dish_portions_ordered') return ok([]);
  if (name === 'cancel_my_order') return cancelMyOrder(args.p_order);
  if (name === 'start_deal') return startDeal(args.p_dish, Number(args.p_price), Number(args.p_quantity));
  if (name === 'end_deal') return endDeal(args.p_deal);
  if (name === 'save_cart' || name === 'register_push_device' || name === 'unregister_push_device') return ok(null);
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
    if (name === 'rider-applications') return ok({ emailed: false, reason: 'demo' });
    return fail(`Unknown function ${name}`);
  },
};

export const demoClient = {
  auth,
  from: (table: string) => new DemoQuery(table),
  rpc,
  functions,
} as unknown as SupabaseClient;
