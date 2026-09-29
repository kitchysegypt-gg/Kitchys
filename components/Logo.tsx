import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

/**
 * The Kitchy's logo on a white badge. The artwork has a white pot and dark
 * tagline, so it always sits on white to look right in every theme.
 */
export function Logo({ width = 220, mark = false }: { width?: number; mark?: boolean }) {
  const ratio = mark ? 386 / 409 : 624 / 760;
  const pad = width * 0.1;
  return (
    <View style={[styles.badge, { padding: pad, borderRadius: width * 0.16 }]}>
      <Image
        source={mark ? require('@/assets/images/logo-mark.png') : require('@/assets/images/logo.png')}
        style={{ width: width - pad * 2, height: (width - pad * 2) * ratio }}
        contentFit="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#B8330D',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 6,
  },
});
