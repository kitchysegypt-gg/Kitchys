import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Category, Chef, Dish } from '@/data/menu';
import { ChefRating, ChefTag, useCatalog } from '@/lib/catalog';
import { CHEF_PHOTOS, DISH_PHOTOS } from '@/lib/photos';
import { useSettings } from '@/lib/settings';
import { Icon, IconName, Txt } from './ui';

const DEFAULT_CHEF_PHOTO = require('@/assets/photos/chef.jpg');
const STAR = '#FFB300';

/** Plain line icon per category, for dishes the chef hasn't photographed yet. */
export const CATEGORY_LINE_ICONS: Record<Category, IconName> = {
  main: 'restaurant-outline',
  baked: 'flame-outline',
  seafood: 'fish-outline',
  desserts: 'ice-cream-outline',
  healthy: 'leaf-outline',
};

/**
 * The chef's own photo of the dish. Without one we show a plain tile, never a stock photo,
 * so every picture in the app is food the customer can actually get.
 */
export function DishArt({ dish, height, radius = 0 }: { dish: Dish; height: number; radius?: number }) {
  const { colors } = useSettings();
  const photo = DISH_PHOTOS[dish.id] ?? (dish.photo ? { uri: dish.photo } : null);
  return (
    <View style={[styles.art, { height, borderRadius: radius, backgroundColor: colors.surfaceAlt }]}>
      {photo ? (
        <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      ) : (
        <Icon name={CATEGORY_LINE_ICONS[dish.category] ?? 'restaurant-outline'} size={Math.min(40, height * 0.3)} color={colors.textMuted} />
      )}
    </View>
  );
}

/** All of a dish's photos, swiped sideways with dots; a single photo shows like DishArt. */
export function DishGallery({ dish, height }: { dish: Dish; height: number }) {
  const { colors } = useSettings();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const photos = dish.photos ?? [];
  if (photos.length < 2) return <DishArt dish={dish} height={height} />;
  return (
    <View style={{ height, backgroundColor: colors.surfaceAlt }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          onScroll={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          scrollEventThrottle={64}>
          {photos.map((uri, i) => (
            <Image key={`${uri}-${i}`} source={{ uri }} style={{ width, height }} contentFit="cover" transition={200} />
          ))}
        </ScrollView>
      )}
      <View style={styles.dots} pointerEvents="none">
        {photos.map((_, i) => (
          <View key={i} style={[styles.dot, { opacity: i === index ? 1 : 0.5, width: i === index ? 18 : 7 }]} />
        ))}
      </View>
    </View>
  );
}

const CATEGORY_PHOTOS: Record<Category, number> = {
  main: require('@/assets/photos/categories/main.jpg'),
  baked: require('@/assets/photos/categories/baked.jpg'),
  seafood: require('@/assets/photos/categories/seafood.jpg'),
  desserts: require('@/assets/photos/categories/desserts.jpg'),
  healthy: require('@/assets/photos/categories/healthy.jpg'),
};

/** Full-bleed photo for a menu category tile. */
export function CategoryPhoto({ category }: { category: Category }) {
  return (
    <Image source={CATEGORY_PHOTOS[category]} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
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
      <Icon name={rating ? 'star' : 'star-outline'} size={14} color={rating ? STAR : color} />
      <Txt variant="caption" color={color} style={{ fontWeight: '800' }}>
        {rating ? `${rating.overall.toFixed(1)} (${rating.review_count})` : t('newChef')}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { position: 'absolute', bottom: 14, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { height: 7, borderRadius: 4, backgroundColor: '#FFFFFF' },
  art: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatar: { overflow: 'hidden', backgroundColor: '#E9EBEE' },
  stars: { flexDirection: 'row', gap: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});

const VERIFIED_BADGE = require('@/assets/icons/verified.png');

const TAG_STYLE: Record<ChefTag, { icon: IconName; color: string; bg: string; darkBg: string; badge?: number }> = {
  popular: { icon: 'flame', color: '#E8590C', bg: '#FFF0E6', darkBg: '#3A2416' },
  verified: { icon: 'shield-checkmark', color: '#1E6FD9', bg: '#E8F1FF', darkBg: '#16263D', badge: VERIFIED_BADGE },
  homemade: { icon: 'home', color: '#1E9E4F', bg: '#E6F7EC', darkBg: '#16301F' },
};

/** The chef's name with the blue Verified badge right after it. */
export function ChefName({
  chef,
  size = 16,
  center,
}: {
  chef: Chef;
  /** Font size of the name; the badge scales with it. */
  size?: number;
  center?: boolean;
}) {
  const { t, l } = useSettings();
  const { chefTags } = useCatalog();
  const verified = chefTags(chef.id).includes('verified');
  return (
    <View style={[tagStyles.nameRow, center && { justifyContent: 'center' }]}>
      <Txt numberOfLines={1} style={{ fontSize: size, fontWeight: '700', flexShrink: 1 }}>
        {l(chef.name)}
      </Txt>
      {verified && (
        <View style={tagStyles.verified} accessibilityLabel={t('tag_verified')}>
          <Image source={VERIFIED_BADGE} style={{ width: size * 0.95, height: size * 0.95 }} contentFit="contain" />
          <Txt style={{ fontSize: Math.max(11, size * 0.7), fontWeight: '700', color: TAG_STYLE.verified.color }}>
            {t('tag_verified')}
          </Txt>
        </View>
      )}
    </View>
  );
}

/** Popular and Homemade badges for a chef (Verified sits next to the name, see ChefName). */
export function ChefTags({ chefId, center }: { chefId: string; center?: boolean }) {
  const { t, colors } = useSettings();
  const { chefTags } = useCatalog();
  return (
    <View style={[tagStyles.row, center && { justifyContent: 'center' }]}>
      {chefTags(chefId)
        .filter((tag) => tag !== 'verified')
        .map((tag) => {
          const s = TAG_STYLE[tag];
          return (
            <View key={tag} style={[tagStyles.tag, { backgroundColor: colors.dark ? s.darkBg : s.bg }]}>
              {s.badge ? (
                <Image source={s.badge} style={{ width: 13, height: 13 }} contentFit="contain" />
              ) : (
                <Icon name={s.icon} size={12} color={s.color} />
              )}
              <Txt style={[tagStyles.text, { color: s.color }]}>{t(`tag_${tag}`)}</Txt>
            </View>
          );
        })}
    </View>
  );
}

const tagStyles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 0 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 8,
  },
  text: { fontSize: 11, fontWeight: '700' },
});
