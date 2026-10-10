import { useCallback, useEffect, useState } from 'react';

import { uploadKitchenPhoto } from './chef';
import { supabase } from './supabase';

/** Kitchy's Premium for chefs: EGP 320 a month, taken from their earnings. */
export const PREMIUM_COMMISSION_RATE = 0.12;

export type Appliance = 'oven' | 'stove' | 'air_fryer' | 'fridge' | 'mixer' | 'other';
export const APPLIANCES: Appliance[] = ['oven', 'stove', 'air_fryer', 'fridge', 'mixer', 'other'];

export type CareRequest = {
  id: string;
  appliance: Appliance;
  problem: string;
  status: 'open' | 'done' | 'cancelled';
  created_at: string;
};

export type PremiumInfo = {
  active: boolean;
  price: number;
  /** End of the month already paid for. */
  period_end: string | null;
  cancel_at_period_end: boolean;
  /** Kitchy's Care opens 30 days after subscribing. */
  care_from: string | null;
  care_used: number;
  care_limit: number;
  care_requests: CareRequest[];
};

/** Emails the Kitchy's team (a failed email doesn't undo what the chef did). */
const tellTeam = (kind: 'premium' | 'care', id?: string) =>
  supabase.functions.invoke('kitchen-requests', { body: { kind, id } }).catch(() => null);

/** Everything on the Premium screen: the subscription and Kitchy's Care. */
export function usePremium() {
  const [info, setInfo] = useState<PremiumInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.rpc('my_premium');
    if (!error && data) setInfo(data as PremiumInfo);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const run = useCallback(
    async (fn: string, args?: Record<string, unknown>) => {
      const { data, error } = await supabase.rpc(fn, args);
      if (error) throw error;
      await refresh();
      return data;
    },
    [refresh]
  );

  const subscribe = useCallback(async () => {
    const wasActive = info?.active;
    await run('premium_subscribe');
    if (!wasActive) tellTeam('premium');
  }, [run, info?.active]);

  const cancel = useCallback(() => run('premium_cancel').then(() => undefined), [run]);

  const requestCare = useCallback(
    async (appliance: Appliance, problem: string, photoUri: string | null) => {
      const photo = await uploadKitchenPhoto(photoUri);
      const id = (await run('care_request', { p_appliance: appliance, p_problem: problem, p_photo: photo })) as string;
      tellTeam('care', id);
    },
    [run]
  );

  return { info, loading, refresh, subscribe, cancel, requestCare };
}
