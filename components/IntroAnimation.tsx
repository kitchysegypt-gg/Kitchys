import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, useWindowDimensions } from 'react-native';

import { useAnimatedValue } from '@/lib/useAnimatedValue';

// The loading screen artwork, cut into layers. Positions are in the original 841 x 1870 picture.
const ART = { width: 841, height: 1870 };
const BACKGROUND = '#FAF5E7';
const LAYERS = {
  waves: { source: require('@/assets/intro/waves.png'), x: 0, y: 1528, width: 841, height: 342 },
  mark: { source: require('@/assets/intro/mark.png'), x: 283, y: 630, width: 284, height: 313 },
  word: { source: require('@/assets/intro/word.png'), x: 185, y: 953, width: 477, height: 155 },
};

/**
 * The Kitchy's opening animation: the orange waves rise in, the K pops and the name follows,
 * then everything fades into the app. Tap to skip. Shorter when the phone asks for reduced motion.
 */
export function IntroAnimation({ onDone }: { onDone: () => void }) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const waves = useAnimatedValue(0);
  const mark = useAnimatedValue(0);
  const word = useAnimatedValue(0);
  const fade = useAnimatedValue(1);
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    Animated.timing(fade, { toValue: 0, duration: 320, useNativeDriver: true }).start(() => onDone());
  };

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (reduce) {
          [waves, mark, word].forEach((v) => v.setValue(1));
          timer = setTimeout(finish, 900);
          return;
        }
        const ease = Easing.out(Easing.cubic);
        Animated.parallel([
          Animated.timing(waves, { toValue: 1, duration: 750, easing: ease, useNativeDriver: true }),
          Animated.spring(mark, { toValue: 1, delay: 180, friction: 5, tension: 70, useNativeDriver: true }),
          Animated.timing(word, { toValue: 1, delay: 480, duration: 450, easing: ease, useNativeDriver: true }),
        ]).start();
        timer = setTimeout(finish, 2000);
      });
    return () => clearTimeout(timer);
    // Runs once when the intro appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fit the artwork to the screen like the picture: logo in the middle, waves on the bottom edge,
  // at most a phone's width on big screens.
  const scale = Math.min(screenW, 480) / ART.width;
  const offsetX = (screenW - ART.width * scale) / 2;
  // Centre the K and the name the way they sit in the picture.
  const logoCentre = (LAYERS.mark.y + LAYERS.word.y + LAYERS.word.height) / 2;
  const offsetY = screenH * (logoCentre / ART.height) - logoCentre * scale;
  const wavesTop = screenH - LAYERS.waves.height * scale;

  const place = (layer: (typeof LAYERS)[keyof typeof LAYERS]) => ({
    position: 'absolute' as const,
    left: offsetX + layer.x * scale,
    top: offsetY + layer.y * scale,
    width: layer.width * scale,
    height: layer.height * scale,
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={finish} accessibilityLabel="Kitchy's">
        <Animated.View
          style={[
            { position: 'absolute', left: 0, right: 0, top: wavesTop, bottom: 0 },
            {
              opacity: waves,
              transform: [{ translateY: waves.interpolate({ inputRange: [0, 1], outputRange: [120 * scale, 0] }) }],
            },
          ]}>
          <Image source={LAYERS.waves.source} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" />
        </Animated.View>

        <Animated.View
          style={[
            place(LAYERS.mark),
            {
              opacity: mark.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
              transform: [
                { scale: mark.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
                { rotate: mark.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '0deg'] }) },
              ],
            },
          ]}>
          <Image source={LAYERS.mark.source} style={StyleSheet.absoluteFill} contentFit="contain" />
        </Animated.View>

        <Animated.View
          style={[
            place(LAYERS.word),
            {
              opacity: word,
              transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [28 * scale, 0] }) }],
            },
          ]}>
          <Image source={LAYERS.word.source} style={StyleSheet.absoluteFill} contentFit="contain" />
        </Animated.View>

      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: BACKGROUND, zIndex: 1000, elevation: 1000 },
});
