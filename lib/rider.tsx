import * as Location from 'expo-location';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useAuth } from './auth';
import { forgetThisPhone } from './notifications';
import type { OrderStatus } from './orders';
import {
  backgroundTrackingAvailable,
  hasBackgroundPermission,
  requestBackgroundPermissions,
  setRiderNotificationWords,
  startBackgroundTracking,
  stopBackgroundTracking,
} from './riderBackground';
import { useSettings } from './settings';
import { useSounds } from './sound';
import { isDemo, supabase } from './supabase';

export type Vehicle = 'motorbike' | 'scooter' | 'bicycle' | 'car';

export type RiderProfile = { id: string; name: string; phone: string; vehicle: Vehicle; area: string | null; online: boolean };

/** 'none' until they apply; 'approved' once the team approves them from the email. */
export type RiderStatus = 'loading' | 'none' | 'pending' | 'rejected' | 'approved';

/** An order as the rider app shows it (customer details only once it's theirs). */
export type RiderOrder = {
  id: string;
  status: OrderStatus;
  scheduled_for: string | null;
  created_at: string;
  ready_at: string | null;
  items: number;
  /** Cash to collect from the customer. */
  cash: number;
  delivery_fee: number;
  /** The customer's tip (all of it is the rider's). */
  tip: number;
  /** What the rider earns for this delivery: EGP 30 plus the tip. The rest of the cash is Kitchy's. */
  pay: number;
  chef: { name: string; area: string | null; lat: number | null; lng: number | null; phone: string | null };
  customer: {
    name: string | null;
    phone: string | null;
    address: string | null;
    notes: string | null;
    lat: number | null;
    lng: number | null;
  };
  to_kitchen_km: number | null;
  trip_km: number | null;
};

/** What a new rider sends: details, national ID (number + photos), selfie and vehicle. */
export type RiderApplicationForm = {
  name: string;
  phone: string;
  vehicle: Vehicle;
  area: string;
  nationalId: string;
  plate: string;
  idFront: string | null;
  idBack: string | null;
  selfie: string | null;
  vehiclePhoto: string | null;
};

/**
 * Uploads an ID or vehicle photo to the private rider-documents bucket (the rider's own
 * folder) and returns its path. Only the rider and the Kitchy's team can open it.
 */
async function uploadRiderDocument(uri: string | null, label: string): Promise<string | null> {
  if (!uri) return null;
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error('Sign in first');
  if (isDemo) return `${userId}/${label}-demo.jpg`;
  const response = await fetch(uri);
  const body = await response.arrayBuffer();
  const type = response.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userId}/${label}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('rider-documents').upload(path, body, { contentType: type });
  if (error) throw error;
  return path;
}

export type RiderStats = {
  deliveries: number;
  cash: number;
  delivery_fees: number;
  /** EGP 30 a delivery plus tips. */
  earnings: number;
  tips: number;
  /** Cash collected minus earnings: what goes to Kitchy's. */
  hand_over: number;
  today_deliveries: number;
  today_cash: number;
  today_earnings: number;
  today_hand_over: number;
  by_day: { day: string; deliveries: number; cash: number; earnings: number }[];
};

type RiderValue = {
  status: RiderStatus;
  rider: RiderProfile | null;
  online: boolean;
  /** Orders waiting for a rider near the rider. */
  available: RiderOrder[];
  /** The rider's own orders: active first, then today's delivered ones. */
  mine: RiderOrder[];
  active: RiderOrder[];
  /** False when the rider said no to sharing their location. */
  locationAllowed: boolean;
  /** True when location and pickup alerts keep going with the screen off. */
  backgroundOn: boolean;
  /** This install can work in the background (rider app v1.2+). */
  backgroundSupported: boolean;
  enableBackground: () => Promise<boolean>;
  refresh: () => Promise<void>;
  apply: (form: RiderApplicationForm) => Promise<void>;
  setOnline: (online: boolean) => Promise<void>;
  claim: (orderId: string) => Promise<void>;
  release: (orderId: string) => Promise<void>;
  setStep: (orderId: string, step: 'picked_up' | 'delivered') => Promise<void>;
  loadStats: (days: number) => Promise<RiderStats | null>;
};

const RiderContext = createContext<RiderValue | null>(null);

/** Everything the Kitchy's Rider app needs, refreshed every 20 seconds while online. */
export function RiderProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const { playOrderSuccess } = useSounds();
  const [status, setStatus] = useState<RiderStatus>('loading');
  const [rider, setRider] = useState<RiderProfile | null>(null);
  const [available, setAvailable] = useState<RiderOrder[]>([]);
  const [mine, setMine] = useState<RiderOrder[]>([]);
  const [locationAllowed, setLocationAllowed] = useState(true);
  const [backgroundOn, setBackgroundOn] = useState(false);
  // Bumped after the rider answers the "all the time" question, to restart tracking.
  const [backgroundAsked, setBackgroundAsked] = useState(0);
  const { t } = useSettings();
  // Ready orders already seen, so a new one makes a sound (not on the first load).
  const seenReady = useRef<Set<string> | null>(null);
  const online = !!rider?.online;

  const loadStatus = useCallback(async () => {
    if (!session) return;
    const { data, error } = await supabase.rpc('my_rider_status');
    if (error || !data) return;
    const result = data as { status: RiderStatus; rider?: RiderProfile };
    setStatus(result.status);
    setRider(result.rider ?? null);
  }, [session]);

  const loadOrders = useCallback(async () => {
    if (!session || status !== 'approved') return;
    const [availableRes, mineRes] = await Promise.all([
      online ? supabase.rpc('rider_available_orders') : Promise.resolve({ data: [], error: null }),
      supabase.rpc('rider_my_orders'),
    ]);
    if (!availableRes.error && Array.isArray(availableRes.data)) {
      const list = availableRes.data as RiderOrder[];
      const ready = list.filter((o) => o.status === 'ready').map((o) => o.id);
      if (seenReady.current && ready.some((id) => !seenReady.current!.has(id))) playOrderSuccess();
      seenReady.current = new Set(ready);
      setAvailable(list);
    }
    if (!mineRes.error && Array.isArray(mineRes.data)) setMine(mineRes.data as RiderOrder[]);
  }, [session, status, online, playOrderSuccess]);

  const refresh = useCallback(async () => {
    await loadStatus();
    await loadOrders();
  }, [loadStatus, loadOrders]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    loadOrders();
    if (status !== 'approved') return;
    const timer = setInterval(loadOrders, 20_000);
    return () => clearInterval(timer);
  }, [loadOrders, status]);

  // While online, share the rider's position (nearby pickups, and customers see them coming).
  // More often while carrying food, so the customer's live map moves smoothly. With "Allow all
  // the time", a background service keeps going with the screen off and notifies about pickups;
  // otherwise it only works while the app is open.
  const delivering = mine.some((o) => o.status === 'on_the_way');
  useEffect(() => {
    if (Platform.OS === 'web' || isDemo) return;
    if (!online) {
      stopBackgroundTracking();
      return;
    }
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    // A Supabase call only goes out once it's awaited (or .then is called), so always await it.
    const send = async (pos: Location.LocationObject) => {
      const { error } = await supabase.rpc('rider_update_location', {
        p_lat: pos.coords.latitude,
        p_lng: pos.coords.longitude,
      });
      if (error) console.warn('Could not share the rider location', error.message);
    };
    (async () => {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      setLocationAllowed(granted);
      if (!granted || cancelled) return;
      // Share where the rider is right away, without waiting for them to move.
      Location.getCurrentPositionAsync({
        accuracy: delivering ? Location.Accuracy.High : Location.Accuracy.Balanced,
      })
        .then((pos) => (cancelled ? null : send(pos)))
        .catch(() => null);
      const background = backgroundTrackingAvailable() && (await hasBackgroundPermission().catch(() => false));
      if (cancelled) return;
      setBackgroundOn(background);
      if (background) {
        await startBackgroundTracking(delivering).catch(() => setBackgroundOn(false));
        return;
      }
      sub = await Location.watchPositionAsync(
        delivering
          ? { accuracy: Location.Accuracy.High, timeInterval: 10_000, distanceInterval: 25 }
          : { accuracy: Location.Accuracy.Balanced, timeInterval: 30_000, distanceInterval: 75 },
        (pos) => {
          send(pos).catch(() => null);
        }
      );
      if (cancelled) sub.remove();
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [online, delivering, backgroundAsked]);

  // Notification wording in the rider's language (the background task has no screen).
  useEffect(() => {
    setRiderNotificationWords({
      serviceTitle: t('riderServiceTitle'),
      serviceBody: t('riderServiceBody'),
      newPickupTitle: t('riderNotifNewTitle'),
      newPickupBody: t('riderNotifNewBody'),
      readyTitle: t('riderNotifReadyTitle'),
      readyBody: t('riderNotifReadyBody'),
      cancelledTitle: t('riderNotifCancelledTitle'),
      cancelledBody: t('riderNotifCancelledBody'),
      channel: t('riderNotifChannel'),
    });
  }, [t]);

  /** Asks for "Allow all the time" and notifications, then restarts tracking with them. */
  const enableBackground = useCallback(async () => {
    const result = await requestBackgroundPermissions();
    setLocationAllowed(result.location);
    setBackgroundAsked((n) => n + 1);
    return result.background;
  }, []);

  const apply = useCallback(
    async (form: RiderApplicationForm) => {
      const bike = form.vehicle !== 'bicycle';
      const [idFront, idBack, selfie, vehiclePhoto] = await Promise.all([
        uploadRiderDocument(form.idFront, 'id-front'),
        uploadRiderDocument(form.idBack, 'id-back'),
        uploadRiderDocument(form.selfie, 'selfie'),
        bike ? uploadRiderDocument(form.vehiclePhoto, 'vehicle') : Promise.resolve(null),
      ]);
      const { data, error } = await supabase.rpc('submit_rider_application', {
        p_name: form.name,
        p_phone: form.phone,
        p_vehicle: form.vehicle,
        p_area: form.area,
        p_national_id: form.nationalId,
        p_plate_number: bike ? form.plate : null,
        p_id_front: idFront,
        p_id_back: idBack,
        p_selfie: selfie,
        p_vehicle_photo: vehiclePhoto,
      });
      if (error) throw error;
      // Emails the team an Approve / Reject link. A failed email doesn't undo the application.
      await supabase.functions.invoke('rider-applications', { body: { application_id: data } }).catch(() => null);
      await loadStatus();
    },
    [loadStatus]
  );

  const call = useCallback(
    async (fn: string, args: Record<string, unknown>) => {
      const { error } = await supabase.rpc(fn, args);
      if (error) throw error;
      await loadOrders();
    },
    [loadOrders]
  );

  const setOnline = useCallback(
    async (value: boolean) => {
      const { error } = await supabase.rpc('rider_set_online', { p_online: value });
      if (error) throw error;
      setRider((r) => (r ? { ...r, online: value } : r));
      if (!value) setAvailable([]);
    },
    []
  );

  const loadStats = useCallback(async (days: number) => {
    const { data, error } = await supabase.rpc('rider_stats', { p_days: days });
    return error ? null : (data as RiderStats);
  }, []);

  const value = useMemo<RiderValue>(
    () => ({
      status,
      rider,
      online,
      available,
      mine,
      active: mine.filter((o) => o.status !== 'delivered'),
      locationAllowed,
      backgroundOn,
      backgroundSupported: backgroundTrackingAvailable(),
      enableBackground,
      refresh,
      apply,
      setOnline,
      claim: (id) => call('rider_claim_order', { p_order: id }),
      release: (id) => call('rider_release_order', { p_order: id }),
      setStep: (id, step) => call('rider_set_order_status', { p_order: id, p_step: step }),
      loadStats,
    }),
    [status, rider, online, available, mine, locationAllowed, backgroundOn, enableBackground, refresh, apply, setOnline, call, loadStats]
  );

  return <RiderContext.Provider value={value}>{children}</RiderContext.Provider>;
}

/** Goes offline, stops notifications on this phone and signs out. */
export async function riderSignOut() {
  await stopBackgroundTracking().catch(() => null);
  await supabase.rpc('rider_set_online', { p_online: false }).then(() => null, () => null);
  await forgetThisPhone().catch(() => {});
  await supabase.auth.signOut();
}

export function useRider() {
  const ctx = useContext(RiderContext);
  if (!ctx) throw new Error('useRider must be used inside RiderProvider');
  return ctx;
}
