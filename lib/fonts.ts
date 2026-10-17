import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import type { TextStyle } from 'react-native';

/** Plus Jakarta Sans, loaded at startup in app/_layout.tsx. */
export const FONT_FILES = {
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
