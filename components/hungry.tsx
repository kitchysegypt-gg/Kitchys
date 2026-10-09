import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Dish } from '@/data/menu';
import { useAuth } from '@/lib/auth';
import { useCatalog } from '@/lib/catalog';
import type { TranslationKey } from '@/lib/i18n';
import { isKitchenOpen } from '@/lib/schedule';
import { useSettings } from '@/lib/settings';
import { softShadow } from '@/lib/theme';
import { useAddToCart } from './menu';
import { Icon, PressableScale, Txt } from './ui';

/** Re-renders every few minutes so time-of-day text stays right while the app is open. */
function useNow(everyMs = 5 * 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

/**
 * "Hungry, Sara?" in the afternoon, "Dinner time!" in the evening, "Plan tonight's dinner"
 * in the morning and "Order for tomorrow" once kitchens are closed.
 */
export function Greeting() {
  const { t, colors } = useSettings();
  const { session } = useAuth();
  const now = useNow();
  const first = ((session?.user.user_metadata?.full_name as string | undefined) ?? '').trim().split(/\s+/)[0];
  const name = first ? t('nameSuffix', { name: first }) : '';
  const hour = now.getHours();
  const [title, sub]: [TranslationKey, TranslationKey] = !isKitchenOpen(now)
    ? hour >= 5 && hour < 12
      ? ['greetMorning', 'greetMorningSub']
      : ['greetLate', 'greetLateSub']
    : hour < 12
      ? ['greetMorning', 'greetMorningSub']
      : hour < 17
        ? ['greetAfternoon', 'greetAfternoonSub']
        : ['greetEvening', 'greetEveningSub'];
  return (
    <View style={styles.greeting}>
      <Txt variant="heading" style={{ fontSize: 24 }} numberOfLines={1}>
        {t(title, { name })}
      </Txt>
      <Txt muted style={{ color: colors.textMuted }} numberOfLines={1}>
        {t(sub)}
      </Txt>
    </View>
  );
}

/**
 * A big photo of tonight's dish at the top of Home: one of the most ordered dishes that has a
 * chef's photo (changes every day), or any photographed dish before there are orders.
 */
export function TonightHero() {
  const { t, l, colors, formatPrice } = useSettings();
  const { popular, dishes, getChef, weekOrders } = useCatalog();
  const addToCart = useAddToCart();
  const [added, setAdded] = useState(false);
  // The dish changes once a day.
  const [day] = useState(() => Math.floor(Date.now() / 86_400_000));

  const dish = useMemo<Dish | undefined>(() => {
    const top = popular.filter((d) => d.photo).slice(0, 5);
    const pool = top.length ? top : dishes.filter((d) => d.photo);
    return pool.length ? pool[day % pool.length] : undefined;
  }, [popular, dishes, day]);

  if (!dish?.photo) return null;
  const chef = getChef(dish.chefId);
  const orders = weekOrders(dish);

  const onAdd = () =>
    addToCart(dish, 1, () => {
      setAdded(true);
      setTimeout(() => setAdded(false), 1400);
    });

  return (
    <PressableScale
      onPress={() => router.push(`/dish/${dish.id}`)}
      style={[styles.heroShadow, softShadow(colors.shadow)]}>
      <View style={styles.hero}>
        <Image source={{ uri: dish.photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.78)']}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.heroPill, { backgroundColor: colors.primary }]}>
          <Icon name="flame" size={13} color={colors.onPrimary} />
          <Txt style={{ color: colors.onPrimary, fontSize: 12, fontWeight: '800' }}>{t('tonightsDinner')}</Txt>
        </View>
        <View style={styles.heroBottom}>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt numberOfLines={1} style={styles.heroTitle}>
              {l(dish.name)}
            </Txt>
            <Txt numberOfLines={1} style={styles.heroMeta}>
              {[chef ? t('heroBy', { chef: l(chef.name) }) : null, t('deliveryWindow')].filter(Boolean).join(' · ')}
            </Txt>
            {orders >= 2 && (
              <Txt numberOfLines={1} style={[styles.heroMeta, { fontWeight: '700' }]}>
                🔥 {t('orderedThisWeek', { n: orders })}
              </Txt>
            )}
          </View>
          <Pressable
            onPress={onAdd}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${t('addToCart')} ${l(dish.name)}`}
            style={[styles.heroButton, { backgroundColor: colors.primary }]}>
            <Icon name={added ? 'checkmark' : 'add'} size={18} color={colors.onPrimary} />
            <Txt style={{ color: colors.onPrimary, fontWeight: '800' }}>
              {added ? t('addedShort') : formatPrice(dish.price)}
            </Txt>
          </Pressable>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  greeting: { paddingHorizontal: 16, marginTop: 10, gap: 2 },
  heroShadow: { marginHorizontal: 16, marginTop: 14, borderRadius: 22 },
  hero: { height: 240, borderRadius: 22, overflow: 'hidden', justifyContent: 'flex-end' },
  heroPill: {
    position: 'absolute',
    top: 12,
    start: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  heroBottom: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, padding: 14 },
  heroTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  heroMeta: { color: 'rgba(255,255,255,0.92)', fontSize: 13 },
  heroButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14 },
});
