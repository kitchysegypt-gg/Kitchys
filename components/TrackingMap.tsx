import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { useAnimatedValue } from '@/lib/useAnimatedValue';

import type { Coordinate } from './TileMap';
import { Icon, Txt } from './ui';

type Props = {
  /** Where the food goes. */
  home: Coordinate;
  /** The rider, once the customer can see them (about 5 minutes away). */
  rider?: Coordinate | null;
  color: string;
  homeLabel: string;
};

const TILE = 256;
const TILE_HEADERS = { 'User-Agent': 'KitchysApp/1.0 (homemade food delivery)' };
// Room around the pins so they never touch the map's edge.
const PADDING = 70;

const worldSize = (zoom: number) => TILE * 2 ** zoom;

function toPixels({ latitude, longitude }: Coordinate, zoom: number) {
  const size = worldSize(zoom);
  const sin = Math.sin((latitude * Math.PI) / 180);
  return {
    x: ((longitude + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}

/** The closest zoom that shows both the rider and home. */
function fitZoom(a: Coordinate, b: Coordinate, width: number, height: number) {
  for (let zoom = 17; zoom > 11; zoom--) {
    const p = toPixels(a, zoom);
    const q = toPixels(b, zoom);
    if (Math.abs(p.x - q.x) <= width - PADDING * 2 && Math.abs(p.y - q.y) <= height - PADDING * 2) return zoom;
  }
  return 12;
}

/**
 * The live delivery map: OpenStreetMap tiles with the customer's home, the rider, and a
 * dotted line between them. Plain views and images, so it works the same on Android,
 * iOS and the website without a maps API key.
 */
export function TrackingMap({ home, rider, color, homeLabel }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const pulse = useAnimatedValue(0);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const view = useMemo(() => {
    if (!size.width || !size.height) return null;
    const zoom = rider ? fitZoom(home, rider, size.width, size.height) : 15;
    const a = toPixels(home, zoom);
    const b = rider ? toPixels(rider, zoom) : a;
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const left = center.x - size.width / 2;
    const top = center.y - size.height / 2;
    const count = 2 ** zoom;

    const tiles: { key: string; uri: string; x: number; y: number }[] = [];
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + size.width) / TILE); tx++) {
      for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + size.height) / TILE); ty++) {
        if (ty < 0 || ty >= count) continue;
        const wrapped = ((tx % count) + count) % count;
        tiles.push({
          key: `${zoom}/${tx}/${ty}`,
          uri: `https://tile.openstreetmap.org/${zoom}/${wrapped}/${ty}.png`,
          x: tx * TILE - left,
          y: ty * TILE - top,
        });
      }
    }

    const homePoint = { x: a.x - left, y: a.y - top };
    const riderPoint = rider ? { x: b.x - left, y: b.y - top } : null;
    // A dot every 12 px from the rider to home.
    const dots: { x: number; y: number }[] = [];
    if (riderPoint) {
      const length = Math.hypot(homePoint.x - riderPoint.x, homePoint.y - riderPoint.y);
      const steps = Math.floor(length / 12);
      for (let i = 1; i < steps; i++) {
        dots.push({
          x: riderPoint.x + ((homePoint.x - riderPoint.x) * i) / steps,
          y: riderPoint.y + ((homePoint.y - riderPoint.y) * i) / steps,
        });
      }
    }
    return { tiles, homePoint, riderPoint, dots };
  }, [home, rider, size]);

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.map]}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      pointerEvents="none">
      {view?.tiles.map((t) => (
        <Image
          key={t.key}
          source={{ uri: t.uri, headers: TILE_HEADERS }}
          cachePolicy="disk"
          style={{ position: 'absolute', left: t.x, top: t.y, width: TILE, height: TILE }}
        />
      ))}
      {/* Soft warm wash so the pins stand out, like a food app map. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255, 244, 230, 0.35)' }]} />

      {view?.dots.map((d, i) => (
        <View key={i} style={[styles.dot, { left: d.x - 2.5, top: d.y - 2.5, backgroundColor: color }]} />
      ))}

      {view && (
        <View style={[styles.homeWrap, { left: view.homePoint.x - 60, top: view.homePoint.y - 22 }]}>
          <View style={[styles.homePin, { backgroundColor: color }]}>
            <Icon name="home" size={20} color="#fff" />
          </View>
          <View style={styles.label}>
            <Txt style={styles.labelText}>{homeLabel}</Txt>
          </View>
        </View>
      )}

      {view?.riderPoint && (
        <View style={[styles.riderWrap, { left: view.riderPoint.x - 30, top: view.riderPoint.y - 30 }]}>
          <Animated.View
            style={[
              styles.ring,
              {
                backgroundColor: color,
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.4] }) }],
              },
            ]}
          />
          <View style={[styles.riderPin, { borderColor: color }]}>
            <Icon name="delivery" size={24} color={color} />
          </View>
        </View>
      )}

      <Txt style={styles.credit}>© OpenStreetMap</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { overflow: 'hidden', backgroundColor: '#EFE9DF' },
  dot: { position: 'absolute', width: 5, height: 5, borderRadius: 3 },
  homeWrap: { position: 'absolute', width: 120, alignItems: 'center', gap: 4 },
  homePin: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  label: { backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, elevation: 2 },
  labelText: { fontSize: 12, fontWeight: '700', color: '#1B1B1F' },
  riderWrap: { position: 'absolute', width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 60, height: 60, borderRadius: 30 },
  riderPin: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#fff',
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
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
