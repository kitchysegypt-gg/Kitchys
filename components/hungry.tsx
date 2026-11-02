import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { Dish } from '@/data/menu';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { useCatalog } from '@/lib/catalog';
import type { TranslationKey } from '@/lib/i18n';
import { useMembership } from '@/lib/membership';
import { useSettings } from '@/lib/settings';
import { softShadow } from '@/lib/theme';
import { useKitchensOpen } from '@/lib/tonight';
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
export function Greeting({ light }: { light?: boolean }) {
  const { t, colors } = useSettings();
  const { session } = useAuth();
  const now = useNow();
  const first = ((session?.user.user_metadata?.full_name as string | undefined) ?? '').trim().split(/\s+/)[0];
  const name = first ? t('nameSuffix', { name: first }) : '';
  const hour = now.getHours();
  const open = useKitchensOpen(now);
  const [title, sub]: [TranslationKey, TranslationKey] = !open
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
      <Txt variant="heading" style={{ fontSize: 30, lineHeight: 38 }} numberOfLines={3} color={light ? '#FFFFFF' : undefined}>
        {t(title, { name })}
      </Txt>
      <Txt style={{ color: light ? '#FFE9DF' : colors.textMuted }} numberOfLines={2}>
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
  const { isMember, membership } = useMembership();
  const addToCart = useAddToCart();
  const { lines, setQuantity } = useCart();
  // The dish changes once a day.
  const [day] = useState(() => Math.floor(Date.now() / 86_400_000));

  const dish = useMemo<Dish | undefined>(() => {
    const top = popular.filter((d) => d.photo || d.testPhoto).slice(0, 5);
    const pool = top.length ? top : dishes.filter((d) => d.photo || d.testPhoto);
    return pool.length ? pool[day % pool.length] : undefined;
  }, [popular, dishes, day]);

  if (!dish?.photo && !dish?.testPhoto) return null;
  const photo = dish.testPhoto ?? { uri: dish.photo };
  // Tonight's dinner is for Kitchy's Premium members; everyone else sees it locked.
  if (!isMember) {
    return (
      <PressableScale onPress={() => router.push('/premium')} style={[styles.heroShadow, softShadow(colors.shadow)]}>
        <View style={styles.hero}>
          <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={18} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]} />
          <View style={[styles.heroPill, { backgroundColor: colors.primary }]}>
            <Icon name="lock-closed" size={12} color={colors.onPrimary} />
            <Txt style={{ color: colors.onPrimary, fontSize: 12, fontWeight: '800' }}>{t('tonightsDinner')}</Txt>
          </View>
          <View style={styles.heroBottom}>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt style={styles.heroTitle}>{t('tonightLockedTitle')}</Txt>
              <Txt style={styles.heroMeta}>
                {t('tonightLockedBody', { price: formatPrice(membership?.price ?? 149) })}
              </Txt>
            </View>
            <View style={[styles.heroButton, { backgroundColor: colors.primary }]}>
              <Txt style={{ color: colors.onPrimary, fontWeight: '700', fontSize: 13 }}>{t('getPremium')}</Txt>
            </View>
          </View>
        </View>
      </PressableScale>
    );
  }
  const chef = getChef(dish.chefId);
  const orders = weekOrders(dish);

  const inCart = lines.find((line) => line.dish.id === dish.id)?.quantity ?? 0;
  const onAdd = () => addToCart(dish, 1);

  return (
    <PressableScale
      onPress={() => router.push(`/dish/${dish.id}`)}
      style={[styles.heroShadow, softShadow(colors.shadow)]}>
      <View style={styles.hero}>
        <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
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
              <View style={styles.heroLine}>
                <Icon name="flame" size={14} color="#FFFFFF" />
                <Txt numberOfLines={1} style={[styles.heroMeta, { fontWeight: '700', flexShrink: 1 }]}>
                  {t('orderedThisWeek', { n: orders })}
                </Txt>
              </View>
            )}
          </View>
          {/* "Add to cart" first; once the dish is in the cart the button grows into - 1 + so more can be added. */}
          <Animated.View layout={LinearTransition.duration(220)} style={[styles.heroButton, { backgroundColor: colors.primary }]}>
            {inCart > 0 ? (
              <Animated.View key="stepper" entering={FadeIn.duration(180)} style={styles.heroStepper}>
                <Pressable
                  onPress={() => setQuantity(dish.id, inCart - 1)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('less')}
                  style={styles.heroStep}>
                  <Icon name={inCart <= 1 ? 'trash-outline' : 'remove'} size={16} color={colors.onPrimary} />
                </Pressable>
                <Txt style={styles.heroQty}>{inCart}</Txt>
                <Pressable
                  onPress={onAdd}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('more')}
                  style={styles.heroStep}>
                  <Icon name="add" size={16} color={colors.onPrimary} />
                </Pressable>
              </Animated.View>
            ) : (
              <Animated.View key="add" entering={FadeIn.duration(180)}>
                <Pressable
                  onPress={onAdd}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('addToCart')} ${l(dish.name)}`}
                  style={styles.heroAdd}>
                  <Icon name="add" size={15} color={colors.onPrimary} />
                  <Txt style={{ color: colors.onPrimary, fontWeight: '700', fontSize: 13 }}>{t('addToCart')}</Txt>
                </Pressable>
              </Animated.View>
            )}
          </Animated.View>
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
  heroLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // Small enough to leave the photo and the dish name room.
  heroButton: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 7, paddingHorizontal: 11, borderRadius: 12 },
  heroAdd: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroStepper: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  heroStep: { width: 26, height: 22, alignItems: 'center', justifyContent: 'center' },
  heroQty: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', minWidth: 20, textAlign: 'center' },
});
