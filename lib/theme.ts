export type ThemeName = 'light' | 'mint';
export type ThemePreference = ThemeName;

export type Palette = {
  dark: boolean;
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  /** Darker shade of primary, used for gradients and pressed states. */
  primaryDeep: string;
  onPrimary: string;
  accent: string;
  success: string;
  /** Soft green behind success text, e.g. the delivery-time pill. */
  successBg: string;
  danger: string;
  shadow: string;
  heroGradient: [string, string];
};

// Brand orange from the Kitchy's logo.
const BRAND = '#F4511E';
const BRAND_DEEP = '#B8330D';

export const THEMES: Record<ThemeName, Palette> = {
  light: {
    dark: false,
    background: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceAlt: '#F4F6F5',
    text: '#1B1D1F',
    textMuted: '#7A7F86',
    border: '#E1E5E2',
    primary: BRAND,
    primaryDeep: BRAND_DEEP,
    onPrimary: '#FFFFFF',
    accent: '#FFB300',
    success: '#1E9E4F',
    successBg: '#E6F7EC',
    danger: '#E5484D',
    shadow: '#0F1A14',
    heroGradient: ['#F4511E', '#9E2A0C'],
  },
  mint: {
    dark: false,
    background: '#F3F8F6',
    surface: '#FFFFFF',
    surfaceAlt: '#E8F2EE',
    text: '#12261E',
    textMuted: '#5D7068',
    border: '#DDEBE5',
    primary: '#F4511E',
    primaryDeep: '#B8330D',
    onPrimary: '#FFFFFF',
    accent: '#14A37F',
    success: '#14A37F',
    successBg: '#DDF5EA',
    danger: '#D93025',
    shadow: '#12261E',
    heroGradient: ['#14A37F', '#0B5E49'],
  },
};

export type AccentName = 'orange' | 'green';

/** Main colour choices. Orange keeps each theme's own brand look. */
export const ACCENTS: Record<AccentName, { primary: string; deep: string; light: string }> = {
  orange: { primary: '#F4511E', deep: '#B8330D', light: '#FF7A45' },
  green: { primary: '#2FB45F', deep: '#1E8646', light: '#4CC47F' },
};
