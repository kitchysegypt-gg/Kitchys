import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, SupabaseClient } from '@supabase/supabase-js';

/**
 * Offline stand-in for the Supabase client, used only in demo builds
 * (EXPO_PUBLIC_DEMO=1), e.g. the web preview where the real API can't be reached.
 * Any email + password (6+ chars) signs in; orders are kept on the device and
 * priced with the same rule as the database trigger (first 3 deliveries free).
 */
const SESSION_KEY = 'kitchys.demo.session';
const ORDERS_KEY = 'kitchys.demo.orders';

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

function ordersKey() {
  return `${ORDERS_KEY}.${current?.user.id ?? 'anon'}`;
}

function from(_table: 'orders') {
  return {
    select() {
      return {
        async order() {
          const rows = await readJSON<Row[]>(ordersKey(), []);
          return { data: rows, error: null };
        },
      };
    },
    insert(values: Row) {
      return {
        select() {
          return {
            async single() {
              const rows = await readJSON<Row[]>(ordersKey(), []);
              const previous = rows.filter((r) => r.status !== 'cancelled').length;
              const delivery_fee = previous < 3 ? 0 : 30;
              const row: Row = {
                ...values,
                id: `demo-${Date.now()}`,
                delivery_fee,
                total: Number(values.subtotal) + delivery_fee,
                status: 'placed',
                created_at: new Date().toISOString(),
              };
              await writeJSON(ordersKey(), [row, ...rows]);
              return { data: row, error: null };
            },
          };
        },
      };
    },
  };
}

export const demoClient = { auth, from } as unknown as SupabaseClient;
