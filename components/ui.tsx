import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollViewProps,
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  TextStyle,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAnimatedValue } from '@/lib/useAnimatedValue';
import { EmojiName } from '@/lib/emoji';
import { useSettings } from '@/lib/settings';
import { Emoji3D } from './Emoji3D';

type TxtProps = TextProps & {
  variant?: 'title' | 'heading' | 'body' | 'caption' | 'label';
  muted?: boolean;
  color?: string;
  center?: boolean;
};

export function Txt({ variant = 'body', muted, color, center, style, ...rest }: TxtProps) {
  const { colors, isRTL } = useSettings();
  return (
    <Text
      {...rest}
      style={[
        styles[variant],
        {
          color: color ?? (muted ? colors.textMuted : colors.text),
          textAlign: center ? 'center' : isRTL ? 'right' : 'left',
          writingDirection: isRTL ? 'rtl' : 'ltr',
        },
        style,
      ]}
    />
  );
}

export function Screen({ children, style, edges = ['top'] }: ViewProps & { edges?: ('top' | 'bottom')[] }) {
  const { colors } = useSettings();
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: colors.background }, style]}>
      {children}
    </SafeAreaView>
  );
}

/** A card with a thick bottom edge and soft shadow so it looks like a raised 3D tile. */
export function Card3D({ children, style, color }: ViewProps & { color?: string }) {
  const { colors } = useSettings();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: color ?? colors.surface,
          borderColor: colors.border,
          shadowColor: colors.shadow,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

/** Springy scale-on-press wrapper used by all tappable cards. */
export function PressableScale({
  children,
  onPress,
  style,
  disabled,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const scale = useAnimatedValue(1);
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 8 }).start();
  return (
    <Pressable onPress={onPress} onPressIn={() => to(0.96)} onPressOut={() => to(1)} disabled={disabled}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

type ButtonProps = {
  title: string;
  onPress?: () => void;
  emoji?: EmojiName;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
};

/** Chunky 3D button: the face sinks into its darker "edge" when pressed. */
export function Button3D({ title, onPress, emoji, variant = 'primary', loading, disabled, style, small }: ButtonProps) {
  const { colors } = useSettings();
  const press = useAnimatedValue(0);
  const depth = small ? 4 : 6;
  const animate = (v: number) => Animated.timing(press, { toValue: v, duration: 80, useNativeDriver: true }).start();

  const face = variant === 'primary' ? colors.primary : variant === 'secondary' ? colors.surfaceAlt : 'transparent';
  const edge = variant === 'primary' ? colors.primaryDeep : variant === 'secondary' ? colors.border : 'transparent';
  const textColor = variant === 'primary' ? colors.onPrimary : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animate(1)}
      onPressOut={() => animate(0)}
      disabled={disabled || loading}
      style={[{ opacity: disabled ? 0.5 : 1 }, style]}>
      <View style={{ borderRadius: 18, backgroundColor: edge, paddingBottom: variant === 'ghost' ? 0 : depth }}>
        <Animated.View
          style={[
            styles.buttonFace,
            small && styles.buttonFaceSmall,
            {
              backgroundColor: face,
              transform: [{ translateY: press.interpolate({ inputRange: [0, 1], outputRange: [0, depth] }) }],
            },
          ]}>
          {loading ? (
            <ActivityIndicator color={textColor} />
          ) : (
            <>
              {emoji && <Emoji3D name={emoji} size={small ? 20 : 26} />}
              <Text style={[styles.buttonText, small && { fontSize: 14 }, { color: textColor }]}>{title}</Text>
            </>
          )}
        </Animated.View>
      </View>
    </Pressable>
  );
}

export function Chip({
  label,
  emoji,
  active,
  onPress,
}: {
  label: string;
  emoji?: EmojiName;
  active?: boolean;
  onPress?: () => void;
}) {
  const { colors } = useSettings();
  return (
    <PressableScale onPress={onPress}>
      <View
        style={[
          styles.chip,
          {
            backgroundColor: active ? colors.primary : colors.surface,
            borderColor: active ? colors.primaryDeep : colors.border,
            shadowColor: colors.shadow,
          },
        ]}>
        {emoji && <Emoji3D name={emoji} size={24} />}
        <Text style={{ fontWeight: '700', color: active ? colors.onPrimary : colors.text }}>{label}</Text>
      </View>
    </PressableScale>
  );
}

export function EmptyState({
  emoji,
  title,
  body,
  children,
}: {
  emoji: EmojiName;
  title: string;
  body?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Emoji3D name={emoji} size={120} float sway />
      <Txt variant="heading" center style={{ marginTop: 16 }}>
        {title}
      </Txt>
      {body && (
        <Txt muted center style={{ marginTop: 6, marginBottom: 20 }}>
          {body}
        </Txt>
      )}
      {children}
    </View>
  );
}

export const scrollContent: ScrollViewProps['contentContainerStyle'] = { padding: 20, paddingBottom: 40 };

const styles = StyleSheet.create({
  title: { fontSize: 30, fontWeight: '900', letterSpacing: -0.5 } as TextStyle,
  heading: { fontSize: 20, fontWeight: '800' },
  body: { fontSize: 15, lineHeight: 22 },
  caption: { fontSize: 13 },
  label: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderBottomWidth: 5,
    padding: 14,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonFace: {
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonFaceSmall: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 14 },
  buttonText: { fontSize: 17, fontWeight: '800' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 3,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
});
