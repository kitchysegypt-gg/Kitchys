import { router } from 'expo-router';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { useAnimatedValue } from '@/lib/useAnimatedValue';
import { Allergen, Chef, Dish, formatPortion } from '@/data/menu';
import { showAlert, showConfirm } from '@/lib/alert';
import { DELIVERY_RADIUS_KM, useCatalog } from '@/lib/catalog';
import { useCart } from '@/lib/cart';
import { useOrders } from '@/lib/orders';
import { useSettings } from '@/lib/settings';
import { DELIVERY_FEE, FREE_DELIVERY_ORDERS } from '@/lib/supabase';
import { ChefAvatar, ChefName, ChefTags, DishArt, RatingBadge } from './media';
import { Button, Card, Icon, PressableScale, Txt } from './ui';

/**
 * Adds to the cart and plays the "add to cart" sound + haptic. Orders come from one chef
 * near the customer, so a far-away chef is refused and a different chef asks to start a
 * new cart. `onAdded` runs once the dish is actually in the cart.
 */
export function useAddToCart() {
  const { add, clear, lines } = useCart();
  const { getChef, isNear, isPaused } = useCatalog();
  const { t, l } = useSettings();
  return (dish: Dish, quantity = 1, onAdded?: () => void) => {
    const chefName = (chefId: string) => {
      const chef = getChef(chefId);
      return chef ? l(chef.name) : '';
    };
    if (!isNear(dish.chefId)) {
      showAlert(t('tooFarTitle'), t('tooFarBody', { chef: chefName(dish.chefId), km: DELIVERY_RADIUS_KM }));
      return;
    }
    if (dish.deal) {
      const inCart = lines.find((line) => line.dish.id === dish.id)?.quantity ?? 0;
      if (inCart + quantity > dish.deal.left) {
        showAlert(t('todaysDeals'), t('dealDetail', { n: dish.deal.left }));
        return;
      }
    }
    if (isPaused(dish.chefId)) {
      showAlert(t('kitchenPaused'), t('kitchenPausedCustomer', { chef: chefName(dish.chefId) }));
      return;
    }
    const addNow = () => {
      add(dish, quantity);
      onAdded?.();
    };
    const otherChef = lines.find((line) => line.dish.chefId !== dish.chefId)?.dish.chefId;
    if (!otherChef) return addNow();
    showConfirm(t('newCartTitle'), t('newCartBody', { chef: chefName(otherChef) }), {
      label: t('newCart'),
      cancelLabel: t('cancel'),
      onConfirm: () => {
        clear();
        addNow();
      },
    });
  };
}

/** Round "+" button that pops when tapped. */
export function QuickAddButton({ dish }: { dish: Dish }) {
  const { colors } = useSettings();
  const addToCart = useAddToCart();
  const pop = useAnimatedValue(1);

  const onPress = () =>
    addToCart(dish, 1, () => {
      pop.setValue(0.8);
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }).start();
    });

  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityLabel="Add to cart">
      <Animated.View style={[styles.quickAdd, { backgroundColor: colors.primary, transform: [{ scale: pop }] }]}>
        <Icon name="add" size={22} color={colors.onPrimary} />
      </Animated.View>
    </Pressable>
  );
}

export function DishCard({ dish, wide }: { dish: Dish; wide?: boolean }) {
  const { t, l, colors, formatPrice } = useSettings();
  const { getChef } = useCatalog();
  const chef = getChef(dish.chefId);
  return (
    <PressableScale onPress={() => router.push(`/dish/${dish.id}`)} style={wide ? undefined : { width: 170 }}>
      <Card style={{ padding: 0 }}>
        {/* Clip the photo to the rounded corners here, so the card's shadow isn't clipped. */}
        <View style={styles.dishClip}>
          <View>
            <DishArt dish={dish} height={wide ? 120 : 130} />
            {dish.deal && (
              <View style={[styles.dealBadge, { backgroundColor: colors.primary }]}>
                <Icon name="flame" size={12} color={colors.onPrimary} />
                <Txt style={{ color: colors.onPrimary, fontSize: 11, fontWeight: '800' }}>
                  {t('dealLeft', { n: dish.deal.left })}
                </Txt>
              </View>
            )}
            {(dish.spicy || dish.vegetarian) && (
              <View style={styles.badges}>
                {dish.spicy && <Icon name="flame" size={14} color="#E53935" />}
                {dish.vegetarian && <Icon name="leaf" size={14} color="#2E9E5B" />}
              </View>
            )}
          </View>
          <View style={{ padding: 12, gap: 2 }}>
            <Txt numberOfLines={1} style={{ fontSize: 15, fontWeight: '700' }}>
              {l(dish.name)}
            </Txt>
            <Txt muted variant="caption" numberOfLines={1}>
              {[chef ? l(chef.name) : l(dish.short), dish.portionGrams ? formatPortion(dish.portionGrams) : null]
                .filter(Boolean)
                .join(' · ')}
            </Txt>
            <View style={styles.priceRow}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexShrink: 1 }}>
                <Txt style={{ fontWeight: '800', color: colors.primary, fontSize: 15 }}>{formatPrice(dish.price)}</Txt>
                {dish.deal && (
                  <Txt variant="caption" muted style={{ textDecorationLine: 'line-through' }}>
                    {formatPrice(dish.deal.originalPrice)}
                  </Txt>
                )}
              </View>
              <QuickAddButton dish={dish} />
            </View>
          </View>
        </View>
      </Card>
    </PressableScale>
  );
}

export function ChefCard({ chef, dishCount }: { chef: Chef; dishCount: number }) {
  const { l, t, colors, isRTL } = useSettings();
  const { ratings } = useCatalog();
  return (
    <PressableScale onPress={() => router.push(`/chef/${chef.id}`)}>
      <Card style={styles.chefCard}>
        <ChefAvatar chef={chef} size={64} />
        <View style={{ flex: 1, gap: 2 }}>
          <ChefName chef={chef} />
          <Txt variant="caption" muted numberOfLines={1}>
            {l(chef.specialty)} · {l(chef.area)}
          </Txt>
          <ChefTags chefId={chef.id} />
          <View style={styles.chefMeta}>
            <RatingBadge rating={ratings[chef.id]} color={colors.text} />
            <Txt variant="caption" muted>
              · {dishCount} {t('dishes')}
            </Txt>
          </View>
        </View>
        <Icon name={isRTL ? 'chevron-back' : 'chevron-forward'} size={20} color={colors.textMuted} />
      </Card>
    </PressableScale>
  );
}

export function AllergenList({ allergens }: { allergens: Allergen[] }) {
  const { t, colors } = useSettings();
  if (allergens.length === 0) {
    return (
      <View style={[styles.noAllergens, { backgroundColor: colors.successBg }]}>
        <Icon name="checkmark-circle" size={26} color={colors.success} />
        <View style={{ flex: 1 }}>
          <Txt style={{ fontWeight: '700', color: colors.success }}>{t('noAllergens')}</Txt>
          <Txt variant="caption" muted>
            {t('noAllergensBody')}
          </Txt>
        </View>
      </View>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.row}>
        <Icon name="warning-outline" size={18} color={colors.danger} />
        <Txt style={{ fontWeight: '700', color: colors.danger }}>{t('containsAllergens')}:</Txt>
      </View>
      <View style={styles.allergenWrap}>
        {allergens.map((a) => (
          <View key={a} style={[styles.allergen, { borderColor: colors.danger }]}>
            <Txt variant="caption" style={{ fontWeight: '600' }}>
              {t(`al_${a}`)}
            </Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Free-delivery stamp card: one stamp per free delivery, crossed off as orders are placed.
 * With `showPoints` it also shows the points balance and rank, linking to rewards.
 */
export function FreeDeliveryBanner({ showPoints }: { showPoints?: boolean }) {
  const { t, colors, formatPrice, isRTL } = useSettings();
  const { freeDeliveriesLeft, points, rank } = useOrders();
  const free = freeDeliveriesLeft > 0;
  const used = FREE_DELIVERY_ORDERS - freeDeliveriesLeft;
  return (
    <View style={[styles.stampCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.stampTop}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt style={{ fontSize: 17, fontWeight: '700' }}>{free ? t('freeDeliveryTitle') : t('delivery')}</Txt>
          <Txt variant="caption" muted>
            {free
              ? t('freeDeliveryBanner', { n: freeDeliveriesLeft })
              : t('freeDeliveryUsed', { fee: formatPrice(DELIVERY_FEE) })}
          </Txt>
        </View>
        <View style={styles.stamps}>
          {Array.from({ length: FREE_DELIVERY_ORDERS }, (_, i) => {
            const spent = i < used;
            return (
              <View
                key={i}
                style={[
                  styles.stamp,
                  spent
                    ? { backgroundColor: colors.surfaceAlt, borderColor: colors.border }
                    : { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}>
                <Icon
                  name={spent ? 'checkmark' : 'delivery'}
                  size={spent ? 16 : 18}
                  color={spent ? colors.textMuted : colors.onPrimary}
                />
              </View>
            );
          })}
        </View>
      </View>
      {showPoints && (
        <Pressable
          onPress={() => router.push('/rewards')}
          style={[styles.pointsRow, { borderTopColor: colors.border }]}>
          <View style={[styles.rankDot, { backgroundColor: rank.color }]}>
            <Icon name={rank.icon} size={13} color="#fff" />
          </View>
          <Txt style={{ flex: 1, fontWeight: '600' }}>
            {t('pointsCount', { n: points.toLocaleString() })}
            <Txt muted>{`  ·  ${t(`rank_${rank.id}`)}`}</Txt>
          </Txt>
          <Txt style={{ color: colors.primary, fontWeight: '600' }}>{t('seeRewards')}</Txt>
          <Icon name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.primary} />
        </Pressable>
      )}
    </View>
  );
}

export function QuantityStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { colors } = useSettings();
  return (
    <View style={[styles.stepper, { borderColor: colors.border }]}>
      <Pressable onPress={() => onChange(value - 1)} hitSlop={6} accessibilityLabel="Less">
        <Icon name={value <= 1 ? 'trash-outline' : 'remove'} size={18} color={colors.primary} />
      </Pressable>
      <Txt style={{ fontWeight: '700', minWidth: 20 }} center>
        {value}
      </Txt>
      <Pressable onPress={() => onChange(value + 1)} hitSlop={6} accessibilityLabel="More">
        <Icon name="add" size={18} color={colors.primary} />
      </Pressable>
    </View>
  );
}

export { Button };

const styles = StyleSheet.create({
  badges: {
    position: 'absolute',
    top: 8,
    end: 8,
    flexDirection: 'row',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  quickAdd: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  chefCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  chefMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  noAllergens: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  allergenWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  allergen: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1 },
  dishClip: { borderRadius: 17, overflow: 'hidden' },
  dealBadge: {
    position: 'absolute',
    top: 8,
    start: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 9,
  },
  stampCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  stampTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  stamps: { flexDirection: 'row', gap: 6 },
  stamp: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  rankDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
});
