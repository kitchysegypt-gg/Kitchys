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

// Brand orange from the Kitchy's logo.
const BRAND = '#F4511E';
const BRAND_DEEP = '#B8330D';

export const THEMES: Record<ThemeName, Palette> = {
  light: {
    dark: false,
    background: '#F6F6F8',
    surface: '#FFFFFF',
    surfaceAlt: '#F1F1F4',
    text: '#1B1B1F',
    textMuted: '#6E6E76',
    border: '#EAEAEE',
    primary: BRAND,
    primaryDeep: BRAND_DEEP,
    onPrimary: '#FFFFFF',
    accent: '#FFB300',
    success: '#1E9E4F',
    successBg: '#E3F6EA',
    danger: '#D93025',
    shadow: '#101018',
    heroGradient: ['#F4511E', '#9E2A0C'],
  },
  dark: {
    dark: true,
    background: '#101012',
    surface: '#1B1B1E',
    surfaceAlt: '#26262A',
    text: '#F4F4F6',
    textMuted: '#A0A0A8',
    border: '#2C2C31',
    primary: '#FF6A3D',
    primaryDeep: '#B8330D',
    onPrimary: '#FFFFFF',
    accent: '#FFC247',
    success: '#4CC47F',
    successBg: '#16301F',
    danger: '#FF6B61',
    shadow: '#000000',
    heroGradient: ['#FF6A3D', '#7A2208'],
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

export type AccentName = 'orange' | 'red' | 'green' | 'blue' | 'purple' | 'pink';

/** Main colour choices. Orange keeps each theme's own brand look. */
export const ACCENTS: Record<AccentName, { primary: string; deep: string; light: string }> = {
  orange: { primary: '#F4511E', deep: '#B8330D', light: '#FF7A45' },
  red: { primary: '#E53935', deep: '#A31F1C', light: '#FF6F60' },
  green: { primary: '#2E9E5B', deep: '#1B6B3C', light: '#4CC47F' },
  blue: { primary: '#1E88E5', deep: '#11589A', light: '#5AAEF2' },
  purple: { primary: '#8E44AD', deep: '#5E2B75', light: '#B26FD0' },
  pink: { primary: '#D6336C', deep: '#96204A', light: '#F06595' },
};
