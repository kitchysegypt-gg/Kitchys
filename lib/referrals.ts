import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { supabase } from './supabase';

/** Share of a referred friend's first order (food, after discounts) paid to the referrer as credit. */
export const REFERRAL_CASHBACK = 0.1;

export type Referral = {
  id: string;
  friend_name: string;
  cashback: number;
  status: 'earned' | 'cancelled';
  created_at: string;
};

/** The signed-in customer's referral code and the friends who used it. */
export function useReferrals() {
  const [code, setCode] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [codeRes, listRes] = await Promise.all([
      supabase.rpc('my_referral_code', {}),
      supabase.from('referrals').select('*').order('created_at', { ascending: false }),
    ]);
    if (codeRes.error) setError(codeRes.error.message);
    else setCode(codeRes.data as string);
    if (!listRes.error && listRes.data) {
      setReferrals((listRes.data as Referral[]).map((r) => ({ ...r, cashback: Number(r.cashback) })));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return { code, referrals, error, reload: load };
}
