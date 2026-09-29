import { useEffect, useRef } from 'react';
import { Platform, StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

export type Coordinate = { latitude: number; longitude: number };

type Props = {
  coordinate: Coordinate;
  onChange: (coordinate: Coordinate) => void;
  pinColor: string;
};

/**
 * Map with a draggable delivery pin. Android uses Google Maps. iOS uses Apple Maps in
 * Expo Go; Google Maps on iOS needs a store build with an API key (see README).
 */
export function DeliveryMap({ coordinate, onChange, pinColor }: Props) {
  const map = useRef<MapView>(null);

  // Follow the pin when it moves from outside the map (e.g. "Use my location").
  useEffect(() => {
    map.current?.animateToRegion({ ...coordinate, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 450);
  }, [coordinate]);

  return (
    <MapView
      ref={map}
      style={StyleSheet.absoluteFill}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      initialRegion={{ ...coordinate, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
      onPress={(e) => onChange(e.nativeEvent.coordinate)}
      showsUserLocation
      showsMyLocationButton={false}
      toolbarEnabled={false}>
      <Marker
        coordinate={coordinate}
        draggable
        pinColor={pinColor}
        onDragEnd={(e) => onChange(e.nativeEvent.coordinate)}
      />
    </MapView>
  );
}
