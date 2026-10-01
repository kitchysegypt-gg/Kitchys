import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Pressable, StyleSheet, View } from 'react-native';

import { showAlert } from '@/lib/alert';
import { useSettings } from '@/lib/settings';
import { isDemo } from '@/lib/supabase';
import { Icon, Txt } from './ui';

/** Optional photo slot: tap to pick from the library, tap the photo again to change it, × to remove it. */
export function PhotoPicker({
  value,
  onChange,
  label,
  round,
  aspect = [4, 3],
}: {
  value: string | null;
  onChange: (uri: string | null) => void;
  label: string;
  /** Round preview, for a person's photo. */
  round?: boolean;
  aspect?: [number, number];
}) {
  const { t, colors } = useSettings();

  const pick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect,
        // Keeps uploads small; plenty for a phone screen.
        quality: 0.6,
        // The demo stores photos in the browser, so it needs the picture itself rather than a temporary link.
        base64: isDemo,
      });
      const asset = result.canceled ? null : result.assets[0];
      if (!asset) return;
      onChange(isDemo && asset.base64 ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` : asset.uri);
    } catch (e: any) {
      showAlert(t('error'), e?.message ?? String(e));
    }
  };

  const size = round ? 96 : undefined;

  return (
    <View style={round ? styles.wrap : undefined}>
      <Pressable
        onPress={pick}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[
          styles.slot,
          round
            ? { width: size, height: size, borderRadius: 48 }
            : { width: '100%', aspectRatio: aspect[0] / aspect[1], borderRadius: 14 },
          { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
        ]}>
        {value ? (
          <Image source={{ uri: value }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={styles.empty}>
            <Icon name="camera-outline" size={round ? 28 : 32} color={colors.textMuted} />
            {!round && (
              <Txt variant="caption" muted center>
                {label}
              </Txt>
            )}
          </View>
        )}
      </Pressable>
      {round && (
        <View style={{ flex: 1, gap: 2 }}>
          <Txt style={{ fontWeight: '600' }}>{label}</Txt>
          <Txt variant="caption" muted>
            {t('photoOptional')}
          </Txt>
        </View>
      )}
      {value && (
        <Pressable
          onPress={() => onChange(null)}
          hitSlop={8}
          accessibilityLabel={t('removePhoto')}
          style={[styles.remove, round ? styles.removeRound : styles.removeCorner]}>
          <Icon name="close" size={16} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  slot: { overflow: 'hidden', borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 6, padding: 12 },
  remove: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeCorner: { top: 8, end: 8 },
  removeRound: { top: 0, start: 72 },
});
