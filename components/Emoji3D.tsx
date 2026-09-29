import { Image } from 'expo-image';
import { useEffect } from 'react';
import { Animated, Easing, StyleProp, View, ViewStyle } from 'react-native';

import { useAnimatedValue } from '@/lib/useAnimatedValue';
import { EMOJI, EmojiName } from '@/lib/emoji';

type Props = {
  name: EmojiName;
  size?: number;
  /** Gently bob up and down with a soft shadow underneath, for a floating 3D look. */
  float?: boolean;
  /** Add a slow sway/tilt on top of the float. */
  sway?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Emoji3D({ name, size = 48, float = false, sway = false, style }: Props) {
  const t = useAnimatedValue(0);

  useEffect(() => {
    if (!float && !sway) return;
    // Random start offset so a grid of emojis doesn't move in lockstep.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const timer = setTimeout(() => loop.start(), Math.random() * 800);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [float, sway, t]);

  const translateY = float ? t.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.08] }) : 0;
  const rotate = sway ? t.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '6deg'] }) : '0deg';
  const shadowScale = float ? t.interpolate({ inputRange: [0, 1], outputRange: [1, 0.8] }) : 1;

  return (
    <View style={[{ width: size, height: size * (float ? 1.12 : 1), alignItems: 'center' }, style]}>
      {float && (
        <Animated.View
          style={{
            position: 'absolute',
            bottom: 0,
            width: size * 0.6,
            height: size * 0.1,
            borderRadius: size,
            backgroundColor: 'rgba(0,0,0,0.18)',
            transform: [{ scaleX: shadowScale }],
          }}
        />
      )}
      <Animated.View style={{ transform: [{ translateY }, { rotate }] }}>
        <Image source={EMOJI[name]} style={{ width: size, height: size }} contentFit="contain" />
      </Animated.View>
    </View>
  );
}
