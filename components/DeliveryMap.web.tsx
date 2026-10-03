import { StyleSheet, View } from 'react-native';

import { useSettings } from '@/lib/settings';

export type Coordinate = { latitude: number; longitude: number };

type Props = {
  coordinate: Coordinate;
  onChange: (coordinate: Coordinate) => void;
  pinColor: string;
};

/**
 * react-native-maps has no web version, so the website shows an OpenStreetMap view
 * centred on the pin. The pin moves with "Use my location"; the address is typed below.
 */
export function DeliveryMap({ coordinate }: Props) {
  const { colors } = useSettings();
  const { latitude: lat, longitude: lon } = coordinate;
  const d = 0.006;
  const src =
    `https://www.openstreetmap.org/export/embed.html?layer=mapnik` +
    `&bbox=${lon - d},${lat - d},${lon + d},${lat + d}&marker=${lat},${lon}`;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceAlt }]}>
      <iframe
        key={src}
        title="Map"
        src={src}
        style={{ border: 0, width: '100%', height: '100%' }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </View>
  );
}
