import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';

import { hasPushToken } from './notifications';
import type { RiderOrder } from './rider';
import { isDemo, supabase } from './supabase';
import { IS_RIDER } from './variant';

/**
 * Kitchy's Rider in the background: while the rider is online, a foreground service keeps
 * sharing their location (so customers can follow them with the screen off) and checks for
 * new pickups, raising a notification on the phone. Works without Firebase push.
 *
 * expo-task-manager is only in rider builds from v1.2 on. It's loaded lazily so the customer
 * app and older rider installs never touch it; they fall back to foreground-only tracking.
 */
export const RIDER_LOCATION_TASK = 'kitchys-rider-location';
const ORDERS_CHANNEL = 'rider-orders';
const SEEN_KEY = 'kitchys.rider.seen';

type TaskManagerModule = typeof import('expo-task-manager');
let taskManager: TaskManagerModule | null | undefined;

function loadTaskManager(): TaskManagerModule | null {
  if (taskManager !== undefined) return taskManager;
  taskManager = null;
  if (!IS_RIDER || Platform.OS === 'web' || isDemo) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    taskManager = require('expo-task-manager') as TaskManagerModule;
  } catch {
    taskManager = null;
  }
  return taskManager;
}

/** Wording for the notifications, set by the app in the rider's language. */
let words = {
  serviceTitle: "Kitchy's Rider is online",
  serviceBody: 'Sharing your location for pickups and deliveries.',
  newPickupTitle: 'New pickup ready',
  newPickupBody: 'Pick up from {area} · collect {cash}',
  readyTitle: 'Your pickup is ready',
  readyBody: '{area}: the food is packed and waiting for you.',
  cancelledTitle: 'Order cancelled',
  cancelledBody: "You don't need to pick it up any more.",
  channel: 'Deliveries',
};
export const setRiderNotificationWords = (w: Partial<typeof words>) => {
  words = { ...words, ...w };
};
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');

let lastCheck = 0;

async function notify(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: 'default', data: { url: '/rider' } },
    trigger: Platform.OS === 'android' ? { channelId: ORDERS_CHANNEL } : null,
  });
}

/**
 * Compares the orders now with the last check and notifies about new pickups, a claimed
 * order becoming ready, and cancellations. Skipped while the app is open (the screen already
 * shows them and plays a sound).
 */
async function checkOrders() {
  const [available, mine] = await Promise.all([supabase.rpc('rider_available_orders'), supabase.rpc('rider_my_orders')]);
  if (available.error || mine.error || !Array.isArray(available.data) || !Array.isArray(mine.data)) return;
  const ready = (available.data as RiderOrder[]).filter((o) => o.status === 'ready');
  const active = (mine.data as RiderOrder[]).filter((o) => o.status !== 'delivered');

  const before = JSON.parse((await AsyncStorage.getItem(SEEN_KEY)) ?? 'null') as {
    ready: string[];
    mine: Record<string, string>;
  } | null;
  await AsyncStorage.setItem(
    SEEN_KEY,
    JSON.stringify({ ready: ready.map((o) => o.id), mine: Object.fromEntries(active.map((o) => [o.id, o.status])) })
  );
  // The server already sends these as push notifications when this phone can receive them.
  if (!before || AppState.currentState === 'active' || hasPushToken()) return;

  const cash = (n: number) => `EGP ${Math.round(n)}`;
  for (const o of ready.filter((o) => !before.ready.includes(o.id))) {
    await notify(words.newPickupTitle, fill(words.newPickupBody, { area: o.chef.area ?? o.chef.name, cash: cash(o.cash) }));
  }
  for (const o of active) {
    if (o.status === 'ready' && before.mine[o.id] && before.mine[o.id] !== 'ready') {
      await notify(words.readyTitle, fill(words.readyBody, { area: o.chef.area ?? o.chef.name }));
    }
  }
  const delivered = new Set((mine.data as RiderOrder[]).filter((o) => o.status === 'delivered').map((o) => o.id));
  for (const id of Object.keys(before.mine)) {
    if (!active.some((o) => o.id === id) && !delivered.has(id)) await notify(words.cancelledTitle, words.cancelledBody);
  }
}

// Must run when the app starts (also when Android wakes it up just for this task).
const tm = loadTaskManager();
if (tm && !tm.isTaskDefined(RIDER_LOCATION_TASK)) {
  tm.defineTask<{ locations: Location.LocationObject[] }>(RIDER_LOCATION_TASK, async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    const pos = data.locations[data.locations.length - 1];
    const { error: sendError } = await supabase.rpc('rider_update_location', {
      p_lat: pos.coords.latitude,
      p_lng: pos.coords.longitude,
    });
    if (sendError) console.warn('Could not share the rider location', sendError.message);
    if (Date.now() - lastCheck > 20_000) {
      lastCheck = Date.now();
      await checkOrders().catch(() => null);
    }
  });
}

/** True when this install can track in the background (rider app v1.2+ on a phone). */
export const backgroundTrackingAvailable = () => !!loadTaskManager();

/** Asks for "Allow all the time" (after the in-app explanation) and for notifications. */
export async function requestBackgroundPermissions() {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return { location: false, background: false };
  await Notifications.setNotificationChannelAsync(ORDERS_CHANNEL, {
    name: words.channel,
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  }).catch(() => null);
  await Notifications.requestPermissionsAsync().catch(() => null);
  const bg = await Location.requestBackgroundPermissionsAsync();
  return { location: true, background: bg.granted };
}

export async function hasBackgroundPermission() {
  const bg = await Location.getBackgroundPermissionsAsync();
  return bg.granted;
}

/** Starts (or updates) background tracking; more often while carrying food. */
export async function startBackgroundTracking(delivering: boolean) {
  if (!loadTaskManager()) return false;
  await Location.startLocationUpdatesAsync(RIDER_LOCATION_TASK, {
    accuracy: delivering ? Location.Accuracy.High : Location.Accuracy.Balanced,
    timeInterval: delivering ? 10_000 : 30_000,
    distanceInterval: delivering ? 25 : 75,
    foregroundService: {
      notificationTitle: words.serviceTitle,
      notificationBody: words.serviceBody,
      notificationColor: '#F4511E',
      killServiceOnDestroy: false,
    },
  });
  return true;
}

export async function stopBackgroundTracking() {
  if (!loadTaskManager()) return;
  if (await Location.hasStartedLocationUpdatesAsync(RIDER_LOCATION_TASK).catch(() => false)) {
    await Location.stopLocationUpdatesAsync(RIDER_LOCATION_TASK).catch(() => null);
  }
}
