export type ThemeName = 'light' | 'dark' | 'sunset' | 'mint';
export type ThemePreference = ThemeName | 'system';

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

// Fresh green brand (Hoomade-inspired); the logo keeps its orange.
const BRAND = '#2FB45F';
const BRAND_DEEP = '#1E8646';

export const THEMES: Record<ThemeName, Palette> = {
  light: {
    dark: false,
    background: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceAlt: '#F4F6F5',
    text: '#1B1D1F',
    textMuted: '#7A7F86',
    border: '#ECEFED',
    primary: BRAND,
    primaryDeep: BRAND_DEEP,
    onPrimary: '#FFFFFF',
    accent: '#FFB300',
    success: '#1E9E4F',
    successBg: '#E6F7EC',
    danger: '#E5484D',
    shadow: '#0F1A14',
    heroGradient: ['#2FB45F', '#16683A'],
  },
  dark: {
    dark: true,
    background: '#101012',
    surface: '#1B1B1E',
    surfaceAlt: '#26262A',
    text: '#F4F4F6',
    textMuted: '#A0A0A8',
    border: '#2C2C31',
    primary: '#3DCB72',
    primaryDeep: '#1E8646',
    onPrimary: '#FFFFFF',
    accent: '#FFC247',
    success: '#4CC47F',
    successBg: '#16301F',
    danger: '#FF6B61',
    shadow: '#000000',
    heroGradient: ['#2FB45F', '#0E4A28'],
  },
  sunset: {
    dark: false,
    background: '#FBF5EF',
    surface: '#FFFFFF',
    surfaceAlt: '#F7ECE2',
    text: '#2B1A12',
    textMuted: '#80645A',
    border: '#F0E2D6',
    primary: '#E8431A',
    primaryDeep: '#9E2A0C',
    onPrimary: '#FFFFFF',
    accent: '#D6336C',
    success: '#1E9E4F',
    successBg: '#E3F6EA',
    danger: '#C62828',
    shadow: '#2B1A12',
    heroGradient: ['#E8431A', '#8E1F4A'],
  },
  mint: {
    dark: false,
    background: '#F3F8F6',
    surface: '#FFFFFF',
    surfaceAlt: '#E8F2EE',
    text: '#12261E',
    textMuted: '#5D7068',
    border: '#DDEBE5',
    primary: '#14A37F',
    primaryDeep: '#0B5E49',
    onPrimary: '#FFFFFF',
    accent: '#14A37F',
    success: '#14A37F',
    successBg: '#DDF5EA',
    danger: '#D93025',
    shadow: '#12261E',
    heroGradient: ['#14A37F', '#0B5E49'],
  },
};

export type AccentName = 'green' | 'orange' | 'red' | 'blue' | 'purple' | 'pink';

/** Main colour choices. Green keeps each theme's own brand look. */
export const ACCENTS: Record<AccentName, { primary: string; deep: string; light: string }> = {
  green: { primary: '#2FB45F', deep: '#1E8646', light: '#4CC47F' },
  orange: { primary: '#F4511E', deep: '#B8330D', light: '#FF7A45' },
  red: { primary: '#E53935', deep: '#A31F1C', light: '#FF6F60' },
  blue: { primary: '#1E88E5', deep: '#11589A', light: '#5AAEF2' },
  purple: { primary: '#8E44AD', deep: '#5E2B75', light: '#B26FD0' },
  pink: { primary: '#D6336C', deep: '#96204A', light: '#F06595' },
};
