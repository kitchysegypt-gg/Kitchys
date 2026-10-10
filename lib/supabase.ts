import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { demoClient } from './demoClient';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

/** Demo builds (EXPO_PUBLIC_DEMO=1) run fully offline with a local stand-in for Supabase. */
export const isDemo = process.env.EXPO_PUBLIC_DEMO === '1';

export const isSupabaseConfigured = isDemo || Boolean(supabaseUrl && supabaseKey);

const realClient = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder-key', {
  auth: {
    // AsyncStorage touches `window` during static web rendering, so only use it in a real runtime.
    ...(Platform.OS !== 'web' || typeof window !== 'undefined' ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const supabase = isDemo ? demoClient : realClient;

// Keep the session fresh only while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export const DELIVERY_FEE = 30;
/** Every order pays this for packaging (also set by the database). */
export const SERVICE_FEE = 20;
export const FREE_DELIVERY_ORDERS = 3;
/** Tip choices at checkout (EGP); every pound goes to the rider. */
export const TIP_OPTIONS = [0, 10, 20, 30] as const;
