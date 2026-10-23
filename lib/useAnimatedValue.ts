import { useState } from 'react';
import { Animated } from 'react-native';

/** Stable Animated.Value for the component's lifetime (works on native and web). */
export function useAnimatedValue(initial: number) {
  const [value] = useState(() => new Animated.Value(initial));
  return value;
}
