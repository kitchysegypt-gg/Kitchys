import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import type { TranslationKey } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { useAnimatedValue } from '@/lib/useAnimatedValue';

const LOGO = require('@/assets/images/loading-logo.png');
const GLOW = require('@/assets/images/loading-glow.png');
const LOGO_RATIO = 491 / 617;
const ORANGE = '#FF4502';
const MESSAGES: TranslationKey[] = ['loading1', 'loading2', 'loading3', 'loading4', 'loading5'];
/** Shown at least this long so the screen never just flashes. */
const MIN_MS = 2200;
const MESSAGE_MS = 1500;

/**
 * Kitchy's loading screen: the logo on cream with a soft warm glow, four bouncing dots and a
 * line under them that keeps changing ("Preparing something delicious...") until the app is
 * ready. Then it fades into the app.
 */
export function LoadingScreen({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const { t, loaded, isRTL } = useSettings();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [minDone, setMinDone] = useState(false);
  const fade = useAnimatedValue(1);
  const text = useAnimatedValue(1);
  const dots = [useAnimatedValue(0), useAnimatedValue(0), useAnimatedValue(0), useAnimatedValue(0)];
  const finished = useRef(false);

  // Bouncing dots, one after the other (still dots when the phone asks for reduced motion).
  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (reduce) return;
        loop = Animated.loop(
          Animated.stagger(
            140,
            dots.map((d) =>
              Animated.sequence([
                Animated.timing(d, { toValue: 1, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }),
                Animated.timing(d, { toValue: 0, duration: 280, easing: Easing.in(Easing.quad), useNativeDriver: true }),
              ])
            )
          )
        );
        loop.start();
      });
    const timer = setTimeout(() => setMinDone(true), MIN_MS);
    return () => {
      loop?.stop();
      clearTimeout(timer);
    };
    // Runs once when the screen appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A new line every moment until the app opens.
  useEffect(() => {
    const timer = setInterval(() => {
      Animated.timing(text, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
        setIndex((i) => (i + 1) % MESSAGES.length);
        Animated.timing(text, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      });
    }, MESSAGE_MS);
    return () => clearInterval(timer);
  }, [text]);

  useEffect(() => {
    if (!ready || !minDone || finished.current) return;
    finished.current = true;
    Animated.timing(fade, { toValue: 0, duration: 320, useNativeDriver: true }).start(() => onDone());
  }, [ready, minDone, fade, onDone]);

  const logoWidth = Math.min(width * 0.56, 240);
  const logoHeight = logoWidth / LOGO_RATIO;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]} accessibilityLabel="Kitchy's">
      <Image source={GLOW} style={StyleSheet.absoluteFill} contentFit="fill" />
      <Image
        source={LOGO}
        style={{ position: 'absolute', width: logoWidth, height: logoHeight, left: (width - logoWidth) / 2, top: height * 0.47 - logoHeight / 2 }}
        contentFit="contain"
      />
      <View style={[styles.bottom, { top: height * 0.82 }]}>
        <View style={styles.dots}>
          {dots.map((d, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
                  transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }],
                },
              ]}
            />
          ))}
        </View>
        {loaded && (
          <Animated.View style={{ opacity: text }}>
            <Text
              style={[styles.message, { fontFamily: isRTL ? 'BalooBhaijaan2_700Bold' : 'Fredoka_600SemiBold' }]}
              maxFontSizeMultiplier={1.2}
              accessibilityLiveRegion="polite">
              {t(MESSAGES[index])}
            </Text>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: '#FDF6EC', zIndex: 1000, elevation: 1000 },
  bottom: { position: 'absolute', left: 24, right: 24, alignItems: 'center', gap: 14 },
  dots: { flexDirection: 'row', gap: 10, height: 16, alignItems: 'flex-end' },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: ORANGE },
  message: { fontSize: 17, color: '#4A3A33', textAlign: 'center' },
});
