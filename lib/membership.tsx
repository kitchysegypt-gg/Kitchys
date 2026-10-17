import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from './auth';
import { supabase } from './supabase';

/**
 * Kitchy's Premium for customers: EGP 149 a month, added to the member's next order.
 * Members get free delivery and Tonight's dinner.
 */
export type Membership = {
  active: boolean;
  price: number;
  period_end: string | null;
  cancel_at_period_end: boolean;
  /** This month's fee, added to the next order (0 once paid). */
  pending_fee: number;
};

type MembershipValue = {
  membership: Membership | null;
  isMember: boolean;
  refresh: () => Promise<void>;
  join: () => Promise<void>;
  cancel: () => Promise<void>;
};

const MembershipContext = createContext<MembershipValue | null>(null);

export function MembershipProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [membership, setMembership] = useState<Membership | null>(null);

  const refresh = useCallback(async () => {
    if (!session) {
      setMembership(null);
      return;
    }
    const { data, error } = await supabase.rpc('my_customer_premium');
    if (!error && data) {
      const m = data as Membership;
      setMembership({ ...m, price: Number(m.price), pending_fee: Number(m.pending_fee) });
    }
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const call = useCallback(
    async (fn: string) => {
      const { error } = await supabase.rpc(fn);
      if (error) throw error;
      await refresh();
    },
    [refresh]
  );

  const value = useMemo<MembershipValue>(
    () => ({
      membership,
      isMember: !!membership?.active,
      refresh,
      join: () => call('customer_premium_subscribe'),
      cancel: () => call('customer_premium_cancel'),
    }),
    [membership, refresh, call]
  );

  return <MembershipContext.Provider value={value}>{children}</MembershipContext.Provider>;
}

export function useMembership() {
  const ctx = useContext(MembershipContext);
  if (!ctx) throw new Error('useMembership must be used inside MembershipProvider');
  return ctx;
}
