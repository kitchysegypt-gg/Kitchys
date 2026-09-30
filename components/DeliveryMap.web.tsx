import { StyleSheet, View } from 'react-native';

import { useSettings } from '@/lib/settings';
import { Icon, Txt } from './ui';

export type Coordinate = { latitude: number; longitude: number };

type Props = {
  coordinate: Coordinate;
  onChange: (coordinate: Coordinate) => void;
  pinColor: string;
};

/** react-native-maps has no web version, so the browser build shows the pin's coordinates instead. */
export function DeliveryMap({ coordinate }: Props) {
  const { colors, t } = useSettings();
  return (
    <View style={[StyleSheet.absoluteFill, styles.wrap, { backgroundColor: colors.surfaceAlt }]}>
      <View style={[styles.grid, { borderColor: colors.border }]} />
      <Icon name="map-outline" size={96} color={colors.border} />
      <Icon name="location" size={48} color={colors.primary} style={styles.pin} />
      <Txt variant="caption" muted center style={styles.coords}>
        {coordinate.latitude.toFixed(5)}, {coordinate.longitude.toFixed(5)}
      </Txt>
      <Txt variant="caption" muted center style={{ paddingHorizontal: 24 }}>
        {t('mapWebNote')}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  grid: { position: 'absolute', inset: 12, borderWidth: 1, opacity: 0.5, borderRadius: 20 },
  pin: { position: 'absolute', top: '32%' },
  coords: { fontVariant: ['tabular-nums'], fontWeight: '700' },
});
