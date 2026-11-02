import { useEffect, useRef } from 'react';
import { Platform, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { TileMap } from './TileMap';

export type Coordinate = { latitude: number; longitude: number };

type Props = {
  coordinate: Coordinate;
  onChange: (coordinate: Coordinate) => void;
  pinColor: string;
};

/**
 * Map with a draggable delivery pin. iOS uses Apple Maps. Android uses OpenStreetMap
 * tiles (TileMap), because Google Maps on Android needs an API key and crashes without one.
 */
export function DeliveryMap(props: Props) {
  if (Platform.OS === 'android') return <TileMap {...props} />;
  return <AppleMap {...props} />;
}

function AppleMap({ coordinate, onChange, pinColor }: Props) {
  const map = useRef<MapView>(null);

  // Follow the pin when it moves from outside the map (e.g. "Use my location").
  useEffect(() => {
    map.current?.animateToRegion({ ...coordinate, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 450);
  }, [coordinate]);

  return (
    <MapView
      ref={map}
      style={StyleSheet.absoluteFill}
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
