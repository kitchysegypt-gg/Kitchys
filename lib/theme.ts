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
  /** Darker shade of primary, used for the "3D" bottom edge of buttons. */
  primaryDeep: string;
  onPrimary: string;
  accent: string;
  success: string;
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
    background: '#FFF8F3',
    surface: '#FFFFFF',
    surfaceAlt: '#FFEDE3',
    text: '#1E1B18',
    textMuted: '#7A6F68',
    border: '#F1DED3',
    primary: BRAND,
    primaryDeep: BRAND_DEEP,
    onPrimary: '#FFFFFF',
    accent: '#FFB300',
    success: '#2E9E5B',
    danger: '#D93025',
    shadow: '#8A3A12',
    heroGradient: ['#FF7A45', BRAND],
  },
  dark: {
    dark: true,
    background: '#15120F',
    surface: '#221D19',
    surfaceAlt: '#2E2621',
    text: '#FBEFE8',
    textMuted: '#B3A59C',
    border: '#3A302A',
    primary: '#FF6A3D',
    primaryDeep: '#B8330D',
    onPrimary: '#FFFFFF',
    accent: '#FFC247',
    success: '#4CC47F',
    danger: '#FF6B61',
    shadow: '#000000',
    heroGradient: ['#FF6A3D', '#C2410C'],
  },
  sunset: {
    dark: false,
    background: '#FFF1E0',
    surface: '#FFFAF3',
    surfaceAlt: '#FFE0C2',
    text: '#3B1F12',
    textMuted: '#8C5E48',
    border: '#F5CFAE',
    primary: '#E8431A',
    primaryDeep: '#9E2A0C',
    onPrimary: '#FFFFFF',
    accent: '#D6336C',
    success: '#2E9E5B',
    danger: '#C62828',
    shadow: '#9E2A0C',
    heroGradient: ['#FF9A3C', '#D6336C'],
  },
  mint: {
    dark: false,
    background: '#F2FBF7',
    surface: '#FFFFFF',
    surfaceAlt: '#DDF5EA',
    text: '#12261E',
    textMuted: '#587066',
    border: '#CBEBDD',
    primary: '#F4511E',
    primaryDeep: '#B8330D',
    onPrimary: '#FFFFFF',
    accent: '#14A37F',
    success: '#14A37F',
    danger: '#D93025',
    shadow: '#1F5C47',
    heroGradient: ['#20C997', '#0E8A6A'],
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
