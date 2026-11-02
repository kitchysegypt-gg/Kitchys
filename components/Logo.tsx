import { Image } from 'expo-image';

/** The Kitchy's logo, straight on the page (both themes have a light background). */
export function Logo({ width = 220, mark = false }: { width?: number; mark?: boolean }) {
  const ratio = mark ? 420 / 394 : 624 / 760;
  return (
    <Image
      source={mark ? require('@/assets/images/logo-mark.png') : require('@/assets/images/logo.png')}
      style={{ width, height: width * ratio, alignSelf: 'center' }}
      contentFit="contain"
      accessibilityLabel="Kitchy's"
    />
  );
}
