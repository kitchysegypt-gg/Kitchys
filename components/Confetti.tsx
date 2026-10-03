import { useEffect, useMemo } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useSettings } from '@/lib/settings';
import { useAnimatedValue } from '@/lib/useAnimatedValue';

const COUNT = 44;
const DURATION = 2600;

/** Small seeded PRNG so each burst's layout is a pure function of its key. */
function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Piece = {
  x: number;
  fall: number;
  sway: number;
  delay: number;
  length: number;
  color: string;
  tilt: number;
  dot: boolean;
};

/**
 * A light, refined celebration: thin ribbons and small dots in the brand colours
 * drift down from the top and fade out. Change `burstKey` to fire a new burst.
 */
export function Confetti({ burstKey, onDone }: { burstKey: number; onDone?: () => void }) {
  const { width, height } = useWindowDimensions();
  const { colors } = useSettings();
  const progress = useAnimatedValue(0);

  const pieces = useMemo<Piece[]>(() => {
    const random = seededRandom(burstKey);
    // Brand colour, a soft tint of it, warm gold and a quiet neutral.
    const palette = [colors.primary, colors.primary, '#F6B48F', '#E9C46A', colors.dark ? '#E7E5E4' : '#2B2B2E'];
    return Array.from({ length: COUNT }, (_, i) => ({
      x: random() * width,
      fall: height * (0.55 + random() * 0.4),
      sway: 12 + random() * 22,
      delay: random() * 0.35,
      length: 10 + random() * 10,
      color: palette[i % palette.length],
      tilt: (random() - 0.5) * 120,
      dot: random() < 0.3,
    }));
  }, [burstKey, width, height, colors.primary, colors.dark]);

  useEffect(() => {
    if (!burstKey) return;
    let cancelled = false;
    progress.setValue(0);
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        // With reduced motion, skip the animation entirely.
        if (reduce) return onDone?.();
        Animated.timing(progress, {
          toValue: 1,
          duration: DURATION,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start(({ finished }) => finished && onDone?.());
      });
    return () => {
      cancelled = true;
    };
  }, [burstKey, progress, onDone]);

  if (!burstKey) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => {
        const start = p.delay;
        const translateY = progress.interpolate({
          inputRange: [0, start, 1],
          outputRange: [-30, -30, p.fall],
        });
        const translateX = progress.interpolate({
          inputRange: [0, start, start + (1 - start) / 3, start + (2 * (1 - start)) / 3, 1],
          outputRange: [p.x, p.x, p.x + p.sway, p.x - p.sway, p.x + p.sway / 2],
        });
        const rotate = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [`${p.tilt}deg`, `${p.tilt + (i % 2 ? 160 : -160)}deg`],
        });
        const opacity = progress.interpolate({
          inputRange: [0, start, start + 0.05, 0.75, 1],
          outputRange: [0, 0, 0.95, 0.85, 0],
        });
        return (
          <Animated.View
            key={`${burstKey}-${i}`}
            style={{ position: 'absolute', left: 0, top: 0, opacity, transform: [{ translateX }, { translateY }, { rotate }] }}>
            <View
              style={
                p.dot
                  ? { width: 6, height: 6, borderRadius: 3, backgroundColor: p.color }
                  : { width: 3, height: p.length, borderRadius: 1.5, backgroundColor: p.color }
              }
            />
          </Animated.View>
        );
      })}
    </View>
  );
}
