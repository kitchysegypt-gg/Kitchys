import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';

import { Icon, Txt } from './ui';

export type Coordinate = { latitude: number; longitude: number };

type Props = {
  coordinate: Coordinate;
  onChange: (coordinate: Coordinate) => void;
  pinColor: string;
};

const TILE = 256;
const MIN_ZOOM = 12;
const MAX_ZOOM = 18;
// OpenStreetMap asks apps to identify themselves when loading tiles.
const TILE_HEADERS = { 'User-Agent': 'KitchysApp/1.0 (Android; homemade food delivery)' };

const worldSize = (zoom: number) => TILE * 2 ** zoom;

function toPixels({ latitude, longitude }: Coordinate, zoom: number) {
  const size = worldSize(zoom);
  const sin = Math.sin((latitude * Math.PI) / 180);
  return {
    x: ((longitude + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}

function toCoordinate(x: number, y: number, zoom: number): Coordinate {
  const size = worldSize(zoom);
  const n = Math.PI - (2 * Math.PI * y) / size;
  return {
    latitude: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))),
    longitude: (x / size) * 360 - 180,
  };
}

/**
 * A map made of OpenStreetMap tiles with the pin fixed in the middle: drag the map to
 * put the pin on the right spot. Used on Android, where Google Maps needs an API key.
 */
export function TileMap({ coordinate, onChange, pinColor }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(16);
  // How far the map is being dragged, for the position it was dragged from.
  const [dragState, setDrag] = useState({ dx: 0, dy: 0, from: '' });
  const here = `${coordinate.latitude},${coordinate.longitude}`;
  // A new position from outside (e.g. "Use my location") ends any drag in progress.
  const drag = dragState.from === here ? dragState : { dx: 0, dy: 0 };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => setDrag({ dx: g.dx, dy: g.dy, from: here }),
        onPanResponderRelease: (_, g) => {
          if (Math.abs(g.dx) < 3 && Math.abs(g.dy) < 3) {
            setDrag({ dx: 0, dy: 0, from: '' });
            return;
          }
          const center = toPixels(coordinate, zoom);
          onChange(toCoordinate(center.x - g.dx, center.y - g.dy, zoom));
        },
        onPanResponderTerminate: () => setDrag({ dx: 0, dy: 0, from: '' }),
      }),
    // Only changes when the pin moves or the zoom changes, never in the middle of a drag.
    [coordinate, zoom, onChange, here]
  );

  const tiles = useMemo(() => {
    if (!size.width || !size.height) return [];
    const center = toPixels(coordinate, zoom);
    const left = center.x - drag.dx - size.width / 2;
    const top = center.y - drag.dy - size.height / 2;
    const count = 2 ** zoom;
    const list: { key: string; uri: string; x: number; y: number }[] = [];
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + size.width) / TILE); tx++) {
      for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + size.height) / TILE); ty++) {
        if (ty < 0 || ty >= count) continue;
        const wrapped = ((tx % count) + count) % count;
        list.push({
          key: `${zoom}/${tx}/${ty}`,
          uri: `https://tile.openstreetmap.org/${zoom}/${wrapped}/${ty}.png`,
          x: tx * TILE - left,
          y: ty * TILE - top,
        });
      }
    }
    return list;
  }, [coordinate, zoom, drag.dx, drag.dy, size]);

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.map]}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      {...pan.panHandlers}>
      {tiles.map((t) => (
        <Image
          key={t.key}
          source={{ uri: t.uri, headers: TILE_HEADERS }}
          cachePolicy="disk"
          style={{ position: 'absolute', left: t.x, top: t.y, width: TILE, height: TILE }}
        />
      ))}

      {/* The pin's tip sits exactly on the map's centre. */}
      <View pointerEvents="none" style={styles.pinWrap}>
        <Icon name="location" size={44} color={pinColor} />
      </View>

      <View style={styles.zoom}>
        <Pressable
          onPress={() => setZoom((z) => Math.min(MAX_ZOOM, z + 1))}
          style={styles.zoomButton}
          accessibilityLabel="Zoom in">
          <Icon name="add" size={22} color="#1B1B1F" />
        </Pressable>
        <View style={styles.zoomDivider} />
        <Pressable
          onPress={() => setZoom((z) => Math.max(MIN_ZOOM, z - 1))}
          style={styles.zoomButton}
          accessibilityLabel="Zoom out">
          <Icon name="remove" size={22} color="#1B1B1F" />
        </Pressable>
      </View>

      <Txt style={styles.credit}>© OpenStreetMap</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { overflow: 'hidden', backgroundColor: '#E8E4DC' },
  pinWrap: { position: 'absolute', left: '50%', top: '50%', marginLeft: -22, marginTop: -42 },
  zoom: {
    position: 'absolute',
    right: 12,
    bottom: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    overflow: 'hidden',
  },
  zoomButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  zoomDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#C9C4BC' },
  credit: {
    position: 'absolute',
    left: 6,
    bottom: 4,
    fontSize: 10,
    color: '#3A3A3A',
    backgroundColor: 'rgba(255,255,255,0.75)',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
});
