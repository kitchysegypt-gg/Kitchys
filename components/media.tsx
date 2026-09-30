import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { Chef, Dish } from '@/data/menu';
import { ChefRating } from '@/lib/catalog';
import { CHEF_PHOTOS, DISH_PHOTOS } from '@/lib/photos';
import { useSettings } from '@/lib/settings';
import { Emoji3D } from './Emoji3D';
import { Txt } from './ui';

/** The dish's AI photo, or its 3D emoji on the chef's colour when there's no photo yet. */
export function DishArt({
  dish,
  height,
  emojiSize,
  radius = 0,
  color,
}: {
  dish: Dish;
  height: number;
  emojiSize: number;
  radius?: number;
  color?: string;
}) {
  const { colors } = useSettings();
  const photo = DISH_PHOTOS[dish.id];
  return (
    <View style={[styles.art, { height, borderRadius: radius, backgroundColor: color ?? colors.surfaceAlt }]}>
      {photo ? (
        <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      ) : (
        <Emoji3D name={dish.emoji} size={emojiSize} float />
      )}
    </View>
  );
}

/** Round chef portrait (AI illustration), or the chef's 3D emoji. */
export function ChefAvatar({ chef, size }: { chef: Chef; size: number }) {
  const photo = CHEF_PHOTOS[chef.id];
  if (!photo) return <Emoji3D name={chef.emoji} size={size} float />;
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
    </View>
  );
}

/** Five stars; tappable when `onChange` is given. */
export function Stars({
  value,
  size = 18,
  onChange,
}: {
  value: number;
  size?: number;
  onChange?: (v: number) => void;
}) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value >= n - 0.25;
        const star = (
          <View style={{ opacity: filled ? 1 : 0.25 }}>
            <Emoji3D name="star" size={size} />
          </View>
        );
        return onChange ? (
          <Pressable key={n} onPress={() => onChange(n)} hitSlop={6} accessibilityLabel={`${n}`}>
            {star}
          </Pressable>
        ) : (
          <View key={n}>{star}</View>
        );
      })}
    </View>
  );
}

/** "★ 4.6 (12)" or "New" when a chef has no reviews yet. */
export function RatingBadge({ rating, color }: { rating?: ChefRating; color?: string }) {
  const { t } = useSettings();
  return (
    <View style={styles.badge}>
      <Emoji3D name={rating ? 'star' : 'sparkles'} size={18} />
      <Txt variant="caption" color={color} style={{ fontWeight: '800' }}>
        {rating ? `${rating.overall.toFixed(1)} (${rating.review_count})` : t('newChef')}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  art: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatar: { overflow: 'hidden', borderWidth: 3, borderColor: '#fff' },
  stars: { flexDirection: 'row', gap: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
