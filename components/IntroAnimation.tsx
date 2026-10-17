import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, useWindowDimensions } from 'react-native';

import { useAnimatedValue } from '@/lib/useAnimatedValue';

// The opening picture, cut into layers. Positions are in the original 852 x 1846 artwork.
const ART = { width: 852, height: 1846 };
const BACKGROUND = '#F8F1E6';
const LAYERS = {
  scene: { source: require('@/assets/intro/scene.jpg'), x: 0, y: 800, width: 852, height: 1046 },
  mark: { source: require('@/assets/intro/mark.png'), x: 272, y: 354, width: 338, height: 320 },
  word: { source: require('@/assets/intro/word.png'), x: 177, y: 696, width: 499, height: 147 },
  tagline: { source: require('@/assets/intro/tagline.png'), x: 230, y: 871, width: 392, height: 75 },
};

/**
 * The Kitchy's opening animation: the food scene rises in, the K pops, the name and
 * "Real food. Real chefs. Near you." follow, then everything fades into the app.
 * Tap to skip. Shorter when the phone asks for reduced motion.
 */
export function IntroAnimation({ onDone }: { onDone: () => void }) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const scene = useAnimatedValue(0);
  const mark = useAnimatedValue(0);
  const word = useAnimatedValue(0);
  const tagline = useAnimatedValue(0);
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
          [scene, mark, word, tagline].forEach((v) => v.setValue(1));
          timer = setTimeout(finish, 900);
          return;
        }
        const ease = Easing.out(Easing.cubic);
        Animated.parallel([
          Animated.timing(scene, { toValue: 1, duration: 750, easing: ease, useNativeDriver: true }),
          Animated.spring(mark, { toValue: 1, delay: 180, friction: 5, tension: 70, useNativeDriver: true }),
          Animated.timing(word, { toValue: 1, delay: 480, duration: 450, easing: ease, useNativeDriver: true }),
          Animated.timing(tagline, { toValue: 1, delay: 820, duration: 450, easing: ease, useNativeDriver: true }),
        ]).start();
        timer = setTimeout(finish, 2300);
      });
    return () => clearTimeout(timer);
    // Runs once when the intro appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fit the artwork to the screen: fill the width (at most a phone's width on big screens),
  // keep the food scene on the bottom edge and the logo below the status bar.
  const width = Math.min(screenW, 480);
  let scale = width / ART.width;
  if (ART.height * scale < screenH) scale = screenH / ART.height;
  const offsetX = (screenW - ART.width * scale) / 2;
  const offsetY = Math.max(screenH - ART.height * scale, 56 - (LAYERS.mark.y - 24) * scale);

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
            place(LAYERS.scene),
            {
              opacity: scene,
              transform: [{ translateY: scene.interpolate({ inputRange: [0, 1], outputRange: [140 * scale, 0] }) }],
            },
          ]}>
          <Image source={LAYERS.scene.source} style={StyleSheet.absoluteFill} contentFit="cover" />
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

        <Animated.View
          style={[
            place(LAYERS.tagline),
            {
              opacity: tagline,
              transform: [{ translateY: tagline.interpolate({ inputRange: [0, 1], outputRange: [16 * scale, 0] }) }],
            },
          ]}>
          <Image source={LAYERS.tagline.source} style={StyleSheet.absoluteFill} contentFit="contain" />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: BACKGROUND, zIndex: 1000, elevation: 1000 },
});
