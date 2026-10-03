import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

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
  /** Cart reminders and "we miss you" notifications on this phone. */
  notificationsEnabled: boolean;
  onboarded: boolean;
  location: SavedLocation | null;
  accent: AccentName;
  /** Set when someone taps "Apply as a home chef" before signing in. */
  wantsChefApply: boolean;
  /** Bumped when the default look changes, to move everyone to it once. */
  styleVersion: number;
};

/** Version 3: back to Kitchy's orange; everyone moves to it once, and can still pick another accent. */
const STYLE_VERSION = 3;

const DEFAULTS: StoredSettings = {
  language: 'en',
  theme: 'light',
  soundEnabled: true,
  notificationsEnabled: true,
  onboarded: false,
  location: null,
  accent: 'orange',
  wantsChefApply: false,
  styleVersion: STYLE_VERSION,
};

type SettingsContextValue = StoredSettings & {
  loaded: boolean;
  colors: Palette;
  themeName: ThemeName;
  isRTL: boolean;
  setLanguage: (language: Language) => void;
  setTheme: (theme: ThemePreference) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
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
  return { ...palette, primary: a.primary, primaryDeep: a.deep, heroGradient: [a.primary, a.deep] };
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<StoredSettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const stored = JSON.parse(raw) as Partial<StoredSettings>;
        const saved: StoredSettings = { ...DEFAULTS, ...stored };
        if ((stored.styleVersion ?? 1) < STYLE_VERSION) {
          saved.accent = 'orange';
          saved.styleVersion = STYLE_VERSION;
        }
        // Removed themes and accents fall back to the defaults.
        if (!THEMES[saved.theme as ThemeName]) saved.theme = 'light';
        if (!ACCENTS[saved.accent]) saved.accent = 'orange';
        setSettings(saved);
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
    // Only Light and Mint remain; older choices (system, dark, sunset) fall back to Light.
    const themeName: ThemeName = THEMES[settings.theme] ? settings.theme : 'light';
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
      setNotificationsEnabled: (notificationsEnabled) => update({ notificationsEnabled }),
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
  }, [settings, loaded, update]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
