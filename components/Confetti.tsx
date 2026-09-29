import { Image } from 'expo-image';
import { useEffect, useMemo } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useAnimatedValue } from '@/lib/useAnimatedValue';
import { EMOJI } from '@/lib/emoji';

const COLORS = ['#F4511E', '#FFB300', '#2E9E5B', '#1E88E5', '#D6336C', '#8E24AA', '#FFD54F'];
const EMOJI_PIECES = [EMOJI.party, EMOJI.sparkles, EMOJI.star, EMOJI.heart] as const;
const COUNT = 90;

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
  peakY: number;
  drift: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  spin: number;
  shape: 'rect' | 'circle' | 'emoji';
  emoji: (typeof EMOJI_PIECES)[number];
};

/**
 * Full-screen confetti burst. Change `burstKey` to fire a new burst.
 * Pieces shoot up from the bottom centre, then flutter down past the screen.
 */
export function Confetti({ burstKey, onDone }: { burstKey: number; onDone?: () => void }) {
  const { width, height } = useWindowDimensions();
  const progress = useAnimatedValue(0);

  const pieces = useMemo<Piece[]>(() => {
    const random = seededRandom(burstKey);
    return Array.from({ length: COUNT }, (_, i) => {
      const r = random();
      return {
        x: random() * width,
        peakY: height * (0.08 + random() * 0.35),
        drift: (random() - 0.5) * 160,
        delay: random() * 0.25,
        duration: 0.55 + random() * 0.45,
        size: 8 + random() * 8,
        color: COLORS[i % COLORS.length],
        spin: (random() > 0.5 ? 1 : -1) * (2 + random() * 4),
        shape: r < 0.14 ? 'emoji' : r < 0.55 ? 'rect' : 'circle',
        emoji: EMOJI_PIECES[i % EMOJI_PIECES.length],
      };
    });
  }, [burstKey, width, height]);

  useEffect(() => {
    if (!burstKey) return;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 3200,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(({ finished }) => finished && onDone?.());
  }, [burstKey, progress, onDone]);

  if (!burstKey) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => {
        const start = p.delay;
        const end = Math.min(1, p.delay + p.duration);
        const peak = start + (end - start) * 0.3;
        const translateY = progress.interpolate({
          inputRange: [0, start, peak, end, 1],
          outputRange: [height + 40, height + 40, p.peakY, height + 60, height + 60],
        });
        const translateX = progress.interpolate({
          inputRange: [0, start, end, 1],
          outputRange: [width / 2, width / 2, p.x + p.drift, p.x + p.drift],
        });
        const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin * 360}deg`] });
        const opacity = progress.interpolate({ inputRange: [0, start, start + 0.01, 1], outputRange: [0, 0, 1, 1] });
        const size = p.shape === 'emoji' ? p.size * 2.6 : p.size;

        return (
          <Animated.View
            key={`${burstKey}-${i}`}
            style={{
              position: 'absolute',
              left: -size / 2,
              top: 0,
              opacity,
              transform: [{ translateX }, { translateY }, { rotate }],
            }}>
            {p.shape === 'emoji' ? (
              <Image source={p.emoji} style={{ width: size, height: size }} />
            ) : (
              <View
                style={{
                  width: size,
                  height: p.shape === 'rect' ? size * 0.45 : size,
                  borderRadius: p.shape === 'circle' ? size : 2,
                  backgroundColor: p.color,
                }}
              />
            )}
          </Animated.View>
        );
      })}
    </View>
  );
}
