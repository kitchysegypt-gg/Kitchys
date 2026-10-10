import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Href, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useAuth } from './auth';
import { useCart } from './cart';
import { useSettings } from './settings';
import { isDemo, supabase } from './supabase';

/**
 * Notifications, following the "smart notifications" flow:
 * the app saves this phone's push token on the account; every hour a Supabase edge function
 * reads each customer's orders and cart, Claude writes a personal message, and it arrives
 * here as a push notification. Tapping it opens the right screen.
 *
 * If the phone can't get a push token (for example before Firebase is set up for Android),
 * the same two reminders are scheduled on the phone itself instead.
 */

const CHANNEL_ID = 'reminders';
const CART_REMINDER_ID = 'kitchys-cart-reminder';
const WEEKLY_REMINDER_ID = 'kitchys-weekly-reminder';
const CART_REMINDER_AFTER_MS = 3 * 60 * 60 * 1000;
const WEEKLY_REMINDER_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
/** Reminders on the phone only arrive between these hours. */
const FIRST_HOUR = 10;
const LAST_HOUR = 20;
/** Screens a notification may open. */
const ALLOWED_URLS = ['/', '/cart', '/orders', '/kitchen/orders', '/rider'];

const supported = Platform.OS !== 'web' && !isDemo;

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** The token registered for this phone, so signing out can remove it. */
let registeredToken: string | null = null;

/** Call before signing out so the next person on this phone doesn't get your reminders. */
export async function forgetThisPhone() {
  if (!supported) return;
  await Promise.all([
    Notifications.cancelScheduledNotificationAsync(CART_REMINDER_ID).catch(() => {}),
    Notifications.cancelScheduledNotificationAsync(WEEKLY_REMINDER_ID).catch(() => {}),
    registeredToken ? supabase.rpc('unregister_push_device', { p_token: registeredToken }) : null,
  ]);
  registeredToken = null;
}

/** Moves a time outside FIRST_HOUR..LAST_HOUR to FIRST_HOUR the next suitable day. */
function withinDayHours(date: Date) {
  const result = new Date(date);
  if (result.getHours() > LAST_HOUR) result.setDate(result.getDate() + 1);
  if (result.getHours() < FIRST_HOUR || result.getHours() > LAST_HOUR) {
    result.setHours(FIRST_HOUR, 0, 0, 0);
  }
  return result;
}

async function scheduleReminder(identifier: string, at: Date, title: string, body: string, url: string) {
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: { title, body, data: { url } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: withinDayHours(at), channelId: CHANNEL_ID },
  });
}

async function pushToken(): Promise<string | null> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;
  try {
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch (error) {
    // On Android this needs Firebase (google-services.json); until then reminders run on the phone.
    console.warn('Push notifications unavailable:', error instanceof Error ? error.message : error);
    return null;
  }
}

/** Opens the screen a tapped notification points to. */
function openFrom(response: Notifications.NotificationResponse | null) {
  const url = response?.notification.request.content.data?.url;
  if (typeof url === 'string' && (ALLOWED_URLS.includes(url) || /^\/dish\/[A-Za-z0-9_-]{1,64}$/.test(url))) {
    router.navigate(url as Href);
  }
}

/** Mount once inside the signed-in part of the app. */
export function NotificationsBridge() {
  const { session } = useAuth();
  const { notificationsEnabled, language, t, l } = useSettings();
  const { lines } = useCart();
  const userId = session?.user.id ?? null;
  // Who sends the reminders: the server (push), this phone (local), or not decided yet.
  const [mode, setMode] = useState<'push' | 'local' | null>(null);
  const tRef = useRef(t);
  tRef.current = t;

  // Taps on notifications, including the one that opened the app.
  useEffect(() => {
    if (!supported) return;
    openFrom(Notifications.getLastNotificationResponse());
    Notifications.clearLastNotificationResponse();
    const subscription = Notifications.addNotificationResponseReceivedListener(openFrom);
    return () => subscription.remove();
  }, []);

  // Permission, push token and the weekly reminder.
  useEffect(() => {
    if (!supported || !userId) return;
    let cancelled = false;
    (async () => {
      if (Platform.OS === 'android') {
        // Android 13+ only shows the permission prompt once a channel exists.
        await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
          name: tRef.current('notifChannel'),
          importance: Notifications.AndroidImportance.HIGH,
        });
      }

      if (!notificationsEnabled) {
        setMode(null);
        await Notifications.cancelScheduledNotificationAsync(CART_REMINDER_ID).catch(() => {});
        await Notifications.cancelScheduledNotificationAsync(WEEKLY_REMINDER_ID).catch(() => {});
        if (registeredToken) {
          await supabase.rpc('register_push_device', {
            p_token: registeredToken,
            p_platform: Platform.OS,
            p_language: language,
            p_enabled: false,
          });
        }
        return;
      }

      let { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
      if (cancelled || status !== 'granted') return;

      const token = await pushToken();
      if (cancelled) return;
      if (token) {
        const { error } = await supabase.rpc('register_push_device', {
          p_token: token,
          p_platform: Platform.OS,
          p_language: language,
          p_enabled: true,
        });
        if (!error) {
          registeredToken = token;
          setMode('push');
          // The server sends the reminders now; drop any scheduled on the phone.
          await Notifications.cancelScheduledNotificationAsync(CART_REMINDER_ID).catch(() => {});
          await Notifications.cancelScheduledNotificationAsync(WEEKLY_REMINDER_ID).catch(() => {});
          return;
        }
      }

      setMode('local');
      // Opening the app pushes the "we miss you" reminder another week away.
      await scheduleReminder(
        WEEKLY_REMINDER_ID,
        new Date(Date.now() + WEEKLY_REMINDER_AFTER_MS),
        tRef.current('localWeeklyTitle'),
        tRef.current('localWeeklyBody'),
        '/'
      );
    })().catch((error) => console.warn('Notifications setup failed:', error));
    return () => {
      cancelled = true;
    };
  }, [userId, notificationsEnabled, language]);

  // Without server push: remind about a forgotten cart from the phone itself.
  const firstDish = lines[0]?.dish;
  const cartKey = lines.map((line) => `${line.dish.id}x${line.quantity}`).join(',');
  useEffect(() => {
    if (!supported || !userId || !notificationsEnabled || mode !== 'local') return;
    const timer = setTimeout(() => {
      if (!cartKey || !firstDish) {
        Notifications.cancelScheduledNotificationAsync(CART_REMINDER_ID).catch(() => {});
        return;
      }
      scheduleReminder(
        CART_REMINDER_ID,
        new Date(Date.now() + CART_REMINDER_AFTER_MS),
        tRef.current('localCartTitle'),
        tRef.current('localCartBody', { dish: l(firstDish.name) }),
        '/cart'
      ).catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, [cartKey, firstDish, userId, notificationsEnabled, mode, l]);

  return null;
}
