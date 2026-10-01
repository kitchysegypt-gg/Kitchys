import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { Chef, Dish } from '@/data/menu';
import { ChefRating } from '@/lib/catalog';
import { CHEF_PHOTOS, DISH_PHOTOS } from '@/lib/photos';
import { useSettings } from '@/lib/settings';
import { Icon, Txt } from './ui';

const DEFAULT_CHEF_PHOTO = require('@/assets/photos/chef.jpg');
const DEFAULT_DISH_PHOTO = require('@/assets/photos/dish.jpg');
const STAR = '#FFB300';

/** The dish's own photo, or the shared Kitchy's dish photo until it has one. */
export function DishArt({ dish, height, radius = 0 }: { dish: Dish; height: number; radius?: number }) {
  const { colors } = useSettings();
  return (
    <View style={[styles.art, { height, borderRadius: radius, backgroundColor: colors.surfaceAlt }]}>
      <Image
        source={DISH_PHOTOS[dish.id] ?? (dish.photo ? { uri: dish.photo } : DEFAULT_DISH_PHOTO)}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={200}
      />
    </View>
  );
}

/** The shared dish photo on its own, e.g. for menu category tiles. */
export function FoodPhoto({ size, radius }: { size: number; radius?: number }) {
  return (
    <View style={[styles.art, { width: size, height: size, borderRadius: radius ?? size / 2 }]}>
      <Image source={DEFAULT_DISH_PHOTO} style={StyleSheet.absoluteFill} contentFit="cover" />
    </View>
  );
}

/** The Kitchy's chef photo in a circle, for places that talk about chefs in general. */
export function ChefPhoto({ size }: { size: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Image source={DEFAULT_CHEF_PHOTO} style={StyleSheet.absoluteFill} contentFit="cover" />
    </View>
  );
}

/** Round chef portrait: the chef's own photo when there is one, otherwise the Kitchy's chef. */
export function ChefAvatar({ chef, size }: { chef: Chef; size: number }) {
  const photo = CHEF_PHOTOS[chef.id] ?? (chef.photo ? { uri: chef.photo } : DEFAULT_CHEF_PHOTO);
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
        const star = <Icon name={filled ? 'star' : 'star-outline'} size={size} color={filled ? STAR : '#C9C9CF'} />;
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
      <Icon name={rating ? 'star' : 'sparkles'} size={14} color={rating ? STAR : color} />
      <Txt variant="caption" color={color} style={{ fontWeight: '800' }}>
        {rating ? `${rating.overall.toFixed(1)} (${rating.review_count})` : t('newChef')}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  art: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatar: { overflow: 'hidden', backgroundColor: '#E9EBEE' },
  stars: { flexDirection: 'row', gap: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
