import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { Language, Localized, TranslationKey, translate } from './i18n';
import { ACCENTS, AccentName, Palette, THEMES, ThemeName, ThemePreference } from './theme';

const STORAGE_KEY = 'kitchys.settings.v1';

export type SavedLocation = {
  latitude: number;
  longitude: number;
  /** Street address, from reverse geocoding or typed by the customer. */
  address: string;
  /** Building, floor, apartment. */
  details: string;
};

type StoredSettings = {
  language: Language;
  theme: ThemePreference;
  soundEnabled: boolean;
  onboarded: boolean;
  location: SavedLocation | null;
  accent: AccentName;
  /** Set when someone taps "Apply as a home chef" before signing in. */
  wantsChefApply: boolean;
};

const DEFAULTS: StoredSettings = {
  language: 'en',
  theme: 'system',
  soundEnabled: true,
  onboarded: false,
  location: null,
  accent: 'orange',
  wantsChefApply: false,
};

type SettingsContextValue = StoredSettings & {
  loaded: boolean;
  colors: Palette;
  themeName: ThemeName;
  isRTL: boolean;
  setLanguage: (language: Language) => void;
  setTheme: (theme: ThemePreference) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setOnboarded: (onboarded: boolean) => void;
  setLocation: (location: SavedLocation | null) => void;
  setAccent: (accent: AccentName) => void;
  setWantsChefApply: (value: boolean) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  /** Pick the current language from a piece of localized content. */
  l: (text: Localized) => string;
  formatPrice: (amount: number) => string;
};

function withAccent(palette: Palette, accent: AccentName): Palette {
  if (accent === 'orange' || !ACCENTS[accent]) return palette;
  const a = ACCENTS[accent];
  return { ...palette, primary: a.primary, primaryDeep: a.deep, heroGradient: [a.light, a.primary] };
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [settings, setSettings] = useState<StoredSettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const update = useCallback((patch: Partial<StoredSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<SettingsContextValue>(() => {
    const themeName: ThemeName =
      settings.theme === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : settings.theme;
    const { language } = settings;
    return {
      ...settings,
      loaded,
      themeName,
      colors: withAccent(THEMES[themeName], settings.accent),
      isRTL: language === 'ar',
      setLanguage: (l) => update({ language: l }),
      setTheme: (theme) => update({ theme }),
      setSoundEnabled: (soundEnabled) => update({ soundEnabled }),
      setOnboarded: (onboarded) => update({ onboarded }),
      setLocation: (location) => update({ location }),
      setAccent: (accent) => update({ accent }),
      setWantsChefApply: (wantsChefApply) => update({ wantsChefApply }),
      t: (key, params) => translate(language, key, params),
      l: (text) => text[language] ?? text.en,
      formatPrice: (amount) =>
        language === 'ar'
          ? `${amount.toLocaleString('ar-EG')} ${translate(language, 'egp')}`
          : `${translate(language, 'egp')} ${amount.toLocaleString('en-US')}`,
    };
  }, [settings, loaded, systemScheme, update]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
