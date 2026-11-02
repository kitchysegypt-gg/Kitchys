import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from './auth';
import type { TranslationKey } from './i18n';
import { SavedLocation, useSettings } from './settings';
import { isDemo, supabase } from './supabase';

export type AddressKind = 'home' | 'work' | 'family' | 'other';
export const ADDRESS_KINDS: AddressKind[] = ['home', 'work', 'family', 'other'];

export type SavedAddress = SavedLocation & { id: string; label: string; kind: AddressKind };

type AddressesValue = {
  addresses: SavedAddress[];
  loaded: boolean;
  add: (place: SavedLocation, kind: AddressKind, label: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

const AddressesContext = createContext<AddressesValue | null>(null);

/** The customer's saved delivery places (home, work, family...), kept on their account. */
export function AddressesProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!session || isDemo) {
      setAddresses([]);
      setLoaded(true);
      return;
    }
    supabase
      .from('saved_addresses')
      .select('id, label, kind, address, details, latitude, longitude')
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setAddresses(data as SavedAddress[]);
        setLoaded(true);
      });
  }, [session]);

  const add = useCallback(async (place: SavedLocation, kind: AddressKind, label: string) => {
    const { data, error } = await supabase
      .from('saved_addresses')
      .insert({ ...place, kind, label })
      .select('id, label, kind, address, details, latitude, longitude')
      .single();
    if (error) throw error;
    setAddresses((prev) => [...prev, data as SavedAddress]);
  }, []);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('saved_addresses').delete().eq('id', id);
    if (error) throw error;
    setAddresses((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const value = useMemo(() => ({ addresses, loaded, add, remove }), [addresses, loaded, add, remove]);
  return <AddressesContext.Provider value={value}>{children}</AddressesContext.Provider>;
}

export function useAddresses() {
  const ctx = useContext(AddressesContext);
  if (!ctx) throw new Error('useAddresses must be used inside AddressesProvider');
  return ctx;
}

/** True when two places are the same spot (within about 30 m) — used to tick the current one. */
export const samePlace = (a: SavedLocation | null, b: SavedLocation) =>
  !!a && Math.abs(a.latitude - b.latitude) < 0.0003 && Math.abs(a.longitude - b.longitude) < 0.0003;

/** The name shown for a saved address: Home / Work / Family in the app's language, or the customer's own name. */
export function useAddressName() {
  const { t } = useSettings();
  return (a: Pick<SavedAddress, 'kind' | 'label'>) => (a.kind === 'other' ? a.label : t(`addrKind_${a.kind}` as TranslationKey));
}
