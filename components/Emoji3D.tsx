import { Image } from 'expo-image';
import { StyleProp, View, ViewStyle } from 'react-native';

import { EMOJI, EmojiName } from '@/lib/emoji';

type Props = {
  name: EmojiName;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/** A 3D food picture, used for dishes and menu categories. */
export function Emoji3D({ name, size = 48, style }: Props) {
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Image source={EMOJI[name]} style={{ width: size, height: size }} contentFit="contain" />
    </View>
  );
}
