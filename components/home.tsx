import { Image } from 'expo-image';
import { Href, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { CATEGORIES, Category, Chef } from '@/data/menu';
import { useCatalog } from '@/lib/catalog';
import { useOrders } from '@/lib/orders';
import { useSettings } from '@/lib/settings';
import { DELIVERY_FEE, supabase } from '@/lib/supabase';
import { softShadow } from '@/lib/theme';
import { CategoryPhoto, ChefAvatar, ChefName, ChefTags, DishArt } from './media';
import { Icon, PressableScale, Txt } from './ui';

// Kitchy's promo banners (1200 x 676).
const PROMO_BANNERS = {
  freeDelivery: require('@/assets/promos/free-delivery.jpg'),
  points: require('@/assets/promos/points.jpg'),
  refer: require('@/assets/promos/refer.jpg'),
  becomeChef: require('@/assets/promos/become-chef.jpg'),
};
const BANNER_RATIO = 1200 / 676;

// Kitchy's 3D category icons; a category without one shows its photo.
const CATEGORY_ICONS: Partial<Record<Category, number>> = {
  main: require('@/assets/categories/main.png'),
  baked: require('@/assets/categories/baked.png'),
  seafood: require('@/assets/categories/seafood.png'),
  desserts: require('@/assets/categories/desserts.png'),
  healthy: require('@/assets/categories/healthy.png'),
};

/** Round category bubbles (3D icon or photo); tap again to show everything. */
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
                { borderColor: active ? colors.primary : 'transparent', backgroundColor: `${colors.primary}14` },
              ]}>
              {CATEGORY_ICONS[c.id as Category] ? (
                <Image source={CATEGORY_ICONS[c.id as Category]} style={styles.bubbleIcon} contentFit="contain" />
              ) : (
                <View style={styles.bubble}>
                  <CategoryPhoto category={c.id as Category} />
                </View>
              )}
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

type BannerRow = { id: string; title: string; image: string; link: string; show_when: string };

const BUILTIN_BANNERS: Record<string, number> = {
  'free-delivery': PROMO_BANNERS.freeDelivery,
  points: PROMO_BANNERS.points,
  refer: PROMO_BANNERS.refer,
  'become-chef': PROMO_BANNERS.becomeChef,
};

/** Where a built-in banner goes when its row's link is 'none'. */
const BUILTIN_TARGETS: Record<string, Href> = {
  'become-chef': '/apply',
};

/** Used until the banner list loads, and if it can't be loaded. */
const DEFAULT_BANNERS: BannerRow[] = [
  { id: 'free-delivery', title: 'Free delivery', image: 'builtin:free-delivery', link: 'chefs', show_when: 'free_delivery' },
  { id: 'points', title: 'Win points', image: 'builtin:points', link: 'rewards', show_when: 'always' },
  { id: 'refer', title: 'Refer a friend', image: 'builtin:refer', link: 'refer', show_when: 'always' },
  { id: 'become-chef', title: 'Become a chef', image: 'builtin:become-chef', link: 'none', show_when: 'always' },
];

const BANNER_LINKS: Record<string, Href | null> = {
  none: null,
  chefs: '/chefs',
  rewards: '/rewards',
  refer: '/refer',
  orders: '/orders',
  cart: '/cart',
  chat: '/chat',
};

/** How long each banner stays before sliding to the next one. */
const AUTO_SLIDE_MS = 7000;

/**
 * Swipeable promo banners. The list comes from the promo_banners table, so banners can be
 * added, reordered or hidden from the Supabase dashboard without an app update.
 */
export function PromoCarousel() {
  const { colors } = useSettings();
  const { freeDeliveriesLeft } = useOrders();
  const { width: screen } = useWindowDimensions();
  const width = Math.min(screen, 560) - 32;
  const step = width + 12;
  const [rows, setRows] = useState<BannerRow[]>(DEFAULT_BANNERS);
  const [index, setIndex] = useState(0);
  const scroller = useRef<ScrollView>(null);
  const touching = useRef(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('promo_banners')
      .select('id, title, image, link, show_when')
      .eq('active', true)
      .order('sort', { ascending: true })
      .then(({ data, error }) => {
        if (!cancelled && !error && Array.isArray(data) && data.length) setRows(data as BannerRow[]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const banners = rows
    .filter((b) => b.show_when !== 'free_delivery' || freeDeliveriesLeft > 0)
    .flatMap((b) => {
      const source = b.image.startsWith('builtin:') ? BUILTIN_BANNERS[b.image.slice(8)] : { uri: b.image };
      return source ? [{ ...b, source }] : [];
    });
  const count = banners.length;

  // Slide to the next banner every few seconds, unless the customer is swiping.
  useEffect(() => {
    if (count < 2) return;
    const timer = setInterval(() => {
      if (touching.current) return;
      setIndex((i) => {
        const next = (i + 1) % count;
        scroller.current?.scrollTo({ x: next * step, animated: true });
        return next;
      });
    }, AUTO_SLIDE_MS);
    return () => clearInterval(timer);
  }, [count, step]);

  if (!count) return null;

  return (
    <View>
      <ScrollView
        ref={scroller}
        horizontal
        snapToInterval={step}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 6, gap: 12 }}
        onScrollBeginDrag={() => {
          touching.current = true;
        }}
        onMomentumScrollEnd={(e) => {
          touching.current = false;
          setIndex(Math.min(count - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / step))));
        }}
        onScrollEndDrag={(e) => {
          setIndex(Math.min(count - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / step))));
        }}>
        {banners.map((b) => {
          const builtin = b.image.startsWith('builtin:') ? b.image.slice(8) : '';
          const target = BANNER_LINKS[b.link] ?? BUILTIN_TARGETS[builtin] ?? null;
          return (
            <View key={b.id} style={[styles.promoShadow, softShadow(colors.shadow)]}>
              <Pressable
                onPress={target ? () => router.navigate(target) : undefined}
                disabled={!target}
                accessibilityRole={target ? 'button' : 'image'}
                accessibilityLabel={b.title}
                style={[styles.promo, { width, height: width / BANNER_RATIO, borderColor: colors.border }]}>
                <Image source={b.source} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
      {count > 1 && (
        <View style={styles.dots}>
          {banners.map((b, i) => (
            <View
              key={b.id}
              style={[
                styles.dot,
                { backgroundColor: i === index ? colors.primary : colors.border, width: i === index ? 18 : 6 },
              ]}
            />
          ))}
        </View>
      )}
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
    <PressableScale onPress={() => router.push(`/chef/${chef.id}`)} style={[styles.kitchenShadow, softShadow(colors.shadow)]}>
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
          <View style={{ paddingEnd: 40 }}>
            <ChefName chef={chef} />
          </View>
          <ChefTags chefId={chef.id} />
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
  bubbleIcon: { width: 50, height: 50 },
  promoShadow: { borderRadius: 20 },
  promo: { borderRadius: 20, overflow: 'hidden', borderWidth: 1 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 },
  dot: { height: 6, borderRadius: 3 },
  kitchenShadow: { width: 252, borderRadius: 18 },
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
