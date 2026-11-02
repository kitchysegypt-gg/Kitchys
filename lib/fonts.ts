import { Rubik_400Regular } from '@expo-google-fonts/rubik/400Regular';
import { Rubik_500Medium } from '@expo-google-fonts/rubik/500Medium';
import { Rubik_600SemiBold } from '@expo-google-fonts/rubik/600SemiBold';
import { Rubik_700Bold } from '@expo-google-fonts/rubik/700Bold';
import { Rubik_800ExtraBold } from '@expo-google-fonts/rubik/800ExtraBold';
import type { TextStyle } from 'react-native';

/**
 * Rubik everywhere (the owner's pick, the free font closest to "Jumper"): text, buttons, prices,
 * titles and the loading screen. It has Arabic letters too, so Arabic uses the same font.
 * Loaded in app/_layout.tsx.
 */
export const FONT_FILES = {
  Rubik_400Regular,
  Rubik_500Medium,
  Rubik_600SemiBold,
  Rubik_700Bold,
  Rubik_800ExtraBold,
};

export const FONT = {
  regular: 'Rubik_400Regular',
  medium: 'Rubik_500Medium',
  semibold: 'Rubik_600SemiBold',
  bold: 'Rubik_700Bold',
  extrabold: 'Rubik_800ExtraBold',
  /** Titles and section headings. */
  display: 'Rubik_700Bold',
  /** Titles in Arabic (Rubik has Arabic letters). */
  displayArabic: 'Rubik_700Bold',
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
