import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import { Fraunces_400Regular } from '@expo-google-fonts/fraunces/400Regular';
import { NotoNaskhArabic_500Medium } from '@expo-google-fonts/noto-naskh-arabic/500Medium';
import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka/600SemiBold';
import { BalooBhaijaan2_700Bold } from '@expo-google-fonts/baloo-bhaijaan-2/700Bold';
import { BalooBhaijaan2_800ExtraBold } from '@expo-google-fonts/baloo-bhaijaan-2/800ExtraBold';
import type { TextStyle } from 'react-native';

/**
 * Plus Jakarta Sans for text; Fraunces for headlines (an elegant, light serif, in black), and
 * Noto Naskh Arabic for Arabic headlines, since Fraunces has no Arabic letters. Fredoka for the
 * loading screen line. Loaded in app/_layout.tsx.
 */
export const FONT_FILES = {
  // The loading screen's line, in the round style of the Kitchy's logo.
  Fredoka_600SemiBold,
  Fraunces_400Regular,
  NotoNaskhArabic_500Medium,
  BalooBhaijaan2_700Bold,
  BalooBhaijaan2_800ExtraBold,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
};

export const FONT = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
  /** The headline font (titles and section headings): elegant and not bold. */
  display: 'Fraunces_400Regular',
  /** Headlines in Arabic, in the same calm style. */
  displayArabic: 'NotoNaskhArabic_500Medium',
} as const;

/**
 * Custom fonts come as one file per weight, so a `fontWeight` has to become the
 * matching font family (Android ignores fontWeight on custom fonts).
 */
export function fontFamilyFor(weight: TextStyle['fontWeight']) {
  switch (String(weight ?? '400')) {
    case '900':
    case '800':
      return FONT.extrabold;
    case '700':
    case 'bold':
      return FONT.bold;
    case '600':
      return FONT.semibold;
    case '500':
      return FONT.medium;
    default:
      return FONT.regular;
  }
}
