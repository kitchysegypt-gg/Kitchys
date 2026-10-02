import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { showAlert } from '@/lib/alert';
import { useSettings } from '@/lib/settings';
import { isDemo } from '@/lib/supabase';
import { Icon, Txt } from './ui';

/** Opens the photo library; returns the picked image (or null if cancelled). */
export async function pickImage(aspect: [number, number]) {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect,
    // Keeps uploads small; plenty for a phone screen.
    quality: 0.6,
    // The demo stores photos in the browser, so it needs the picture itself rather than a temporary link.
    base64: isDemo && Platform.OS !== 'web',
  });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  if (Platform.OS === 'web') return shrinkForWeb(asset.uri);
  return isDemo && asset.base64 ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` : asset.uri;
}

/**
 * Browsers hand back the full-size photo (a phone picture can be 5-10 MB), which is
 * too big to upload quickly or to keep in the demo's browser storage. Redraw it at
 * most 900 px wide/tall as a JPEG, which is plenty for a phone screen.
 */
async function shrinkForWeb(uri: string, maxSide = 900): Promise<string> {
  const img = new window.Image();
  img.src = uri;
  await img.decode();
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.75);
}

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
      const uri = await pickImage(aspect);
      if (uri) onChange(uri);
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
  stripRow: { flexDirection: 'row', alignItems: 'center' },
  strip: { flexDirection: 'row', gap: 8 },
  thumb: { flex: 1, maxWidth: '24%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', borderWidth: 1 },
  coverTag: { position: 'absolute', bottom: 4, start: 4, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  removeThumb: { top: 4, end: 4, width: 22, height: 22, borderRadius: 11 },
});

/**
 * A row of up to `max` photo slots for a dish: the first photo is the cover,
 * × removes one, and the dashed slot adds another from the library.
 */
export function PhotoStrip({
  value,
  onChange,
  max,
  busy,
}: {
  value: string[];
  onChange: (uris: string[]) => void;
  max: number;
  /** Shows a spinner on the add slot while photos are being saved. */
  busy?: boolean;
}) {
  const { t, colors } = useSettings();

  const add = async () => {
    try {
      const uri = await pickImage([4, 3]);
      if (uri) onChange([...value, uri].slice(0, max));
    } catch (e: any) {
      showAlert(t('error'), e?.message ?? String(e));
    }
  };

  return (
    <View style={{ gap: 6 }}>
      <View style={styles.stripRow}>
        <Txt style={{ fontWeight: '600', flex: 1 }}>{t('dishPhotos')}</Txt>
        <Txt variant="caption" muted>
          {value.length}/{max}
        </Txt>
      </View>
      <View style={styles.strip}>
        {value.map((uri, i) => (
          <View key={`${uri}-${i}`} style={[styles.thumb, { borderColor: colors.border }]}>
            <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            {i === 0 && (
              <View style={[styles.coverTag, { backgroundColor: colors.primary }]}>
                <Txt style={{ color: colors.onPrimary, fontSize: 10, fontWeight: '700' }}>{t('cover')}</Txt>
              </View>
            )}
            <Pressable
              onPress={() => onChange(value.filter((_, j) => j !== i))}
              hitSlop={8}
              disabled={busy}
              accessibilityLabel={t('removePhoto')}
              style={[styles.remove, styles.removeThumb]}>
              <Icon name="close" size={14} color="#fff" />
            </Pressable>
          </View>
        ))}
        {value.length < max && (
          <Pressable
            onPress={add}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t('addPhoto')}
            style={[styles.thumb, styles.slot, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            {busy ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Icon name="camera-outline" size={22} color={colors.textMuted} />
                <Txt variant="caption" muted center style={{ fontSize: 11 }}>
                  {t('addPhoto')}
                </Txt>
              </>
            )}
          </Pressable>
        )}
      </View>
      <Txt variant="caption" muted>
        {t('dishPhotosHint', { n: max })}
      </Txt>
    </View>
  );
}
