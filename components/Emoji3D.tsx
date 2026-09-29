import { Image } from 'expo-image';
import { useEffect } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleProp, View, ViewStyle } from 'react-native';

import { EMOJI, EmojiName } from '@/lib/emoji';
import { useAnimatedValue } from '@/lib/useAnimatedValue';

type Props = {
  name: EmojiName;
  size?: number;
  /** Slowly drift up and down, like it's hovering. */
  float?: boolean;
  /** Add a very small tilt on top of the float. */
  sway?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Emoji3D({ name, size = 48, float = false, sway = false, style }: Props) {
  const t = useAnimatedValue(0);

  useEffect(() => {
    if (!float && !sway) return;
    let loop: Animated.CompositeAnimation | undefined;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (reduce || cancelled) return;
        // One smooth sine cycle; every animated emoji shares the same rhythm so
        // nothing on screen moves out of step with its neighbours.
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(t, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(t, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ])
        );
        loop.start();
      });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [float, sway, t]);

  const transform = [
    ...(float
      ? [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -Math.max(2, size * 0.04)] }) }]
      : []),
    ...(sway ? [{ rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] }) }] : []),
  ];

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Animated.View style={transform.length ? { transform } : undefined}>
        <Image source={EMOJI[name]} style={{ width: size, height: size }} contentFit="contain" />
      </Animated.View>
    </View>
  );
}
