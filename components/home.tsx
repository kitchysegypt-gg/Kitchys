import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { CATEGORIES, Category, Chef } from '@/data/menu';
import { useCatalog } from '@/lib/catalog';
import { useOrders } from '@/lib/orders';
import { useSettings } from '@/lib/settings';
import { DELIVERY_FEE } from '@/lib/supabase';
import { CategoryPhoto, ChefAvatar, DishArt } from './media';
import { Icon, PressableScale, Txt } from './ui';

const PROMO_PHOTOS = {
  delivery: require('@/assets/photos/dish.jpg'),
  refer: require('@/assets/photos/categories/desserts.jpg'),
  points: require('@/assets/photos/categories/main.jpg'),
};

/** Round photo bubbles for the menu categories; tap again to show everything. */
export function CategoryBubbles({ value, onChange }: { value: Category | 'all'; onChange: (c: Category | 'all') => void }) {
  const { t, colors } = useSettings();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bubbles}>
      {CATEGORIES.filter((c) => c.id !== 'all').map((c) => {
        const active = value === c.id;
        return (
          <Pressable
            key={c.id}
            onPress={() => onChange(active ? 'all' : (c.id as Category))}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={styles.bubbleItem}>
            <View
              style={[
                styles.bubbleRing,
                { borderColor: active ? colors.primary : 'transparent', backgroundColor: colors.successBg },
              ]}>
              <View style={styles.bubble}>
                <CategoryPhoto category={c.id as Category} />
              </View>
            </View>
            <Txt
              variant="caption"
              center
              numberOfLines={1}
              style={{ fontSize: 12, fontWeight: active ? '700' : '500', color: active ? colors.primary : colors.text }}>
              {t(c.label)}
            </Txt>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

type Promo = {
  key: string;
  title: string;
  body: string;
  action: string;
  onPress: () => void;
  photo: number;
  background: string;
  ink: string;
  buttonBg: string;
  buttonInk: string;
};

/** Swipeable promo banners: free delivery, refer a friend, points. */
export function PromoCarousel() {
  const { t, colors } = useSettings();
  const { freeDeliveriesLeft, points, rank } = useOrders();
  const { width: screen } = useWindowDimensions();
  const width = Math.min(screen, 560) - 32;
  const [index, setIndex] = useState(0);

  const promos: Promo[] = [
    ...(freeDeliveriesLeft > 0
      ? [
          {
            key: 'delivery',
            title: t('promoFreeTitle'),
            body: t('promoFreeBody', { n: freeDeliveriesLeft }),
            action: t('orderNow'),
            onPress: () => router.navigate('/chefs'),
            photo: PROMO_PHOTOS.delivery,
            background: '#1E2A23',
            ink: '#FFFFFF',
            buttonBg: colors.primary,
            buttonInk: '#FFFFFF',
          },
        ]
      : []),
    {
      key: 'refer',
      title: t('promoReferTitle'),
      body: t('promoReferBody'),
      action: t('invite'),
      onPress: () => router.push('/refer'),
      photo: PROMO_PHOTOS.refer,
      background: colors.primary,
      ink: '#FFFFFF',
      buttonBg: '#FFFFFF',
      buttonInk: colors.primaryDeep,
    },
    {
      key: 'points',
      title: t('pointsCount', { n: points.toLocaleString() }),
      body: t('promoPointsBody', { rank: t(`rank_${rank.id}`) }),
      action: t('seeRewards'),
      onPress: () => router.push('/rewards'),
      photo: PROMO_PHOTOS.points,
      background: '#FFF3DF',
      ink: '#2A1D0C',
      buttonBg: '#2A1D0C',
      buttonInk: '#FFFFFF',
    },
  ];

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled={false}
        snapToInterval={width + 12}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        onScroll={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / (width + 12)))}
        scrollEventThrottle={64}>
        {promos.map((p) => (
          <Pressable key={p.key} onPress={p.onPress} style={[styles.promo, { width, backgroundColor: p.background }]}>
            <View style={styles.promoText}>
              <Txt numberOfLines={2} style={{ color: p.ink, fontSize: 22, fontWeight: '800', lineHeight: 27 }}>
                {p.title}
              </Txt>
              <Txt numberOfLines={2} style={{ color: p.ink, opacity: 0.8, fontSize: 13, marginTop: 4 }}>
                {p.body}
              </Txt>
              <View style={[styles.promoButton, { backgroundColor: p.buttonBg }]}>
                <Txt style={{ color: p.buttonInk, fontWeight: '700', fontSize: 13 }}>{p.action}</Txt>
              </View>
            </View>
            <View style={styles.promoPhoto}>
              <Image source={p.photo} style={StyleSheet.absoluteFill} contentFit="cover" />
            </View>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {promos.map((p, i) => (
          <View
            key={p.key}
            style={[
              styles.dot,
              { backgroundColor: i === index ? colors.primary : colors.border, width: i === index ? 18 : 6 },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

/** "Kitchen near you" card: the chef's cover dish, rating, delivery info and tags. */
export function KitchenCard({ chef }: { chef: Chef }) {
  const { t, l, colors, formatPrice } = useSettings();
  const { ratings, dishesByChef } = useCatalog();
  const { freeDeliveriesLeft } = useOrders();
  const dishes = dishesByChef(chef.id);
  const cover = dishes.find((d) => d.photo) ?? dishes[0];
  const rating = ratings[chef.id];
  return (
    <PressableScale onPress={() => router.push(`/chef/${chef.id}`)} style={{ width: 252 }}>
      <View style={[styles.kitchen, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View>
          {cover ? (
            <DishArt dish={cover} height={136} />
          ) : (
            <View style={{ height: 136, backgroundColor: colors.surfaceAlt }} />
          )}
          <View style={styles.ratingPill}>
            <Icon name={rating ? 'star' : 'sparkles'} size={12} color="#FFB300" />
            <Txt style={{ fontSize: 12, fontWeight: '700', color: '#1B1D1F' }}>
              {rating ? rating.overall.toFixed(1) : t('newChef')}
            </Txt>
          </View>
          <View style={[styles.kitchenAvatar, { borderColor: colors.surface }]}>
            <ChefAvatar chef={chef} size={40} />
          </View>
        </View>
        <View style={{ padding: 12, gap: 4 }}>
          <Txt numberOfLines={1} style={{ fontSize: 16, fontWeight: '700', paddingEnd: 36 }}>
            {l(chef.name)}
          </Txt>
          <View style={styles.metaRow}>
            <Icon name="delivery" size={14} color={colors.primary} />
            <Txt variant="caption" muted numberOfLines={1}>
              {freeDeliveriesLeft > 0 ? t('freeDeliveryBadge') : formatPrice(DELIVERY_FEE)} · {t('deliveryWindow')}
            </Txt>
          </View>
          <View style={styles.tags}>
            <View style={[styles.tag, { backgroundColor: colors.surfaceAlt }]}>
              <Txt numberOfLines={1} style={styles.tagText}>
                {l(chef.specialty)}
              </Txt>
            </View>
            <View style={[styles.tag, { backgroundColor: colors.surfaceAlt }]}>
              <Txt style={styles.tagText}>
                {dishes.length} {t('dishes')}
              </Txt>
            </View>
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  bubbles: { gap: 14, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  bubbleItem: { width: 78, alignItems: 'center', gap: 6 },
  bubbleRing: { width: 66, height: 66, borderRadius: 33, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  bubble: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden' },
  promo: { height: 148, borderRadius: 20, flexDirection: 'row', overflow: 'hidden' },
  promoText: { flex: 1, padding: 16, justifyContent: 'center' },
  promoButton: { alignSelf: 'flex-start', marginTop: 10, paddingVertical: 7, paddingHorizontal: 14, borderRadius: 10 },
  promoPhoto: { width: 128, height: 128, borderRadius: 64, overflow: 'hidden', alignSelf: 'center', marginEnd: -16 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 },
  dot: { height: 6, borderRadius: 3 },
  kitchen: { borderRadius: 18, overflow: 'hidden', borderWidth: 1 },
  ratingPill: {
    position: 'absolute',
    top: 10,
    start: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  kitchenAvatar: { position: 'absolute', end: 10, bottom: -20, borderRadius: 24, borderWidth: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tags: { flexDirection: 'row', gap: 6, marginTop: 4 },
  tag: { paddingVertical: 4, paddingHorizontal: 9, borderRadius: 8, maxWidth: 150 },
  tagText: { fontSize: 12, fontWeight: '500' },
});
