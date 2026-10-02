import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
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

import { EmojiName } from '@/lib/emoji';
import { FONT, fontFamilyFor } from '@/lib/fonts';
import { useSettings } from '@/lib/settings';
import { useAnimatedValue } from '@/lib/useAnimatedValue';
import { Emoji3D } from './Emoji3D';

/** Any Ionicons name, plus "delivery": the Kitchy's delivery scooter. */
export type IconName = React.ComponentProps<typeof Ionicons>['name'] | 'delivery';

const DELIVERY_ICON = require('@/assets/images/delivery.png');

/** Outline icon from Ionicons, tinted with the theme's text colour by default. */
export function Icon({
  name,
  size = 22,
  color,
  style,
}: {
  name: IconName;
  size?: number;
  color?: React.ComponentProps<typeof Ionicons>['color'];
  style?: StyleProp<TextStyle>;
}) {
  const { colors } = useSettings();
  if (name === 'delivery') {
    // The scooter is wider than tall, so give it a little extra room.
    const box = Math.round(size * 1.25);
    return (
      <Image
        source={DELIVERY_ICON}
        style={{ width: box, height: box, marginHorizontal: -(box - size) / 2 }}
        tintColor={(color as string | undefined) ?? colors.text}
        contentFit="contain"
        accessibilityIgnoresInvertColors
      />
    );
  }
  return <Ionicons name={name} size={size} color={color ?? colors.text} style={style} />;
}

type TxtProps = TextProps & {
  variant?: 'title' | 'heading' | 'body' | 'caption' | 'label';
  muted?: boolean;
  color?: string;
  center?: boolean;
};

export function Txt({ variant = 'body', muted, color, center, style, ...rest }: TxtProps) {
  const { colors, isRTL } = useSettings();
  const weight = (StyleSheet.flatten([styles[variant], style]) as TextStyle | undefined)?.fontWeight;
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
        // The font file carries the weight; fontWeight itself is reset so it isn't faked on top.
        { fontFamily: fontFamilyFor(weight), fontWeight: 'normal' },
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

/** Title bar for pushed screens: back arrow, title and an optional action on the other side. */
export function ScreenHeader({ title, right, onBack }: { title: string; right?: React.ReactNode; onBack?: () => void }) {
  const { isRTL } = useSettings();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <View style={styles.header}>
      <Pressable onPress={back} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
        <Icon name={isRTL ? 'chevron-forward' : 'chevron-back'} size={26} />
      </Pressable>
      <Txt variant="heading" numberOfLines={1} style={{ flex: 1 }}>
        {title}
      </Txt>
      {right}
    </View>
  );
}

/** A plain white rounded card. */
export function Card({ children, style, color }: ViewProps & { color?: string }) {
  const { colors } = useSettings();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: color ?? colors.surface, shadowColor: colors.shadow, borderColor: colors.border },
        style,
      ]}>
      {children}
    </View>
  );
}

/** Slight shrink on press, used by tappable cards. */
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
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  return (
    // Layout styles (width, flex) go on the outer Pressable so percentages size against the parent.
    <Pressable onPress={onPress} onPressIn={() => to(0.98)} onPressOut={() => to(1)} disabled={disabled} style={style}>
      <Animated.View style={{ flexGrow: 1, transform: [{ scale }] }}>{children}</Animated.View>
    </Pressable>
  );
}

type ButtonProps = {
  title: string;
  onPress?: () => void;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
};

export function Button({ title, onPress, icon, variant = 'primary', loading, disabled, style, small }: ButtonProps) {
  const { colors } = useSettings();
  const background = variant === 'primary' ? colors.primary : variant === 'secondary' ? colors.surfaceAlt : 'transparent';
  const textColor = variant === 'primary' ? colors.onPrimary : variant === 'secondary' ? colors.text : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: background, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon && <Icon name={icon} size={small ? 17 : 20} color={textColor} />}
          <Text style={[styles.buttonText, small && { fontSize: 14 }, { color: textColor }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Pill filter. Takes an outline icon, or a food emoji where a picture helps (menu categories). */
export function Chip({
  label,
  icon,
  emoji,
  active,
  onPress,
}: {
  label: string;
  icon?: IconName;
  emoji?: EmojiName;
  active?: boolean;
  onPress?: () => void;
}) {
  const { colors } = useSettings();
  const textColor = active ? colors.onPrimary : colors.text;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border },
      ]}>
      {icon && <Icon name={icon} size={16} color={textColor} />}
      {emoji && <Emoji3D name={emoji} size={20} />}
      <Text style={{ fontFamily: FONT.semibold, fontSize: 14, color: textColor }}>{label}</Text>
    </Pressable>
  );
}

/** Rounded group of rows, like a settings list. */
export function ListGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  const { colors } = useSettings();
  return (
    <View style={{ gap: 8 }}>
      {title && (
        <Txt variant="label" muted style={{ paddingHorizontal: 4 }}>
          {title}
        </Txt>
      )}
      <View style={[styles.group, { backgroundColor: colors.surface }]}>{children}</View>
    </View>
  );
}

export function ListRow({
  icon,
  label,
  detail,
  onPress,
  right,
  color,
}: {
  icon: IconName;
  label: string;
  detail?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  color?: string;
}) {
  const { colors, isRTL } = useSettings();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceAlt : 'transparent' }]}>
      <Icon name={icon} size={24} color={color} />
      <View style={{ flex: 1 }}>
        <Txt style={{ fontSize: 16, fontWeight: '500' }} color={color}>
          {label}
        </Txt>
        {detail ? (
          <Txt variant="caption" muted numberOfLines={1}>
            {detail}
          </Txt>
        ) : null}
      </View>
      {right ?? (onPress ? <Icon name={isRTL ? 'chevron-back' : 'chevron-forward'} size={20} color={colors.textMuted} /> : null)}
    </Pressable>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  children,
}: {
  icon: IconName;
  title: string;
  body?: string;
  children?: React.ReactNode;
}) {
  const { colors } = useSettings();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceAlt }]}>
        <Icon name={icon} size={40} color={colors.primary} />
      </View>
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
  title: { fontSize: 25, fontWeight: '700', letterSpacing: -0.5 } as TextStyle,
  heading: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 } as TextStyle,
  body: { fontSize: 15, lineHeight: 22 },
  caption: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  card: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 0,
  },
  button: {
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonSmall: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12 },
  buttonText: { fontSize: 16, fontFamily: FONT.bold },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  group: { borderRadius: 18, overflow: 'hidden', paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 15, paddingHorizontal: 18 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
});
