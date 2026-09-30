import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { useAnimatedValue } from '@/lib/useAnimatedValue';
import { ALLERGEN_EMOJI, Allergen, Chef, Dish } from '@/data/menu';
import { useCatalog } from '@/lib/catalog';
import { useCart } from '@/lib/cart';
import { useOrders } from '@/lib/orders';
import { useSettings } from '@/lib/settings';
import { useSounds } from '@/lib/sound';
import { DELIVERY_FEE } from '@/lib/supabase';
import { Emoji3D } from './Emoji3D';
import { ChefAvatar, DishArt, RatingBadge } from './media';
import { Button3D, Card3D, PressableScale, Txt } from './ui';

/** Adds to the cart and plays the "add to cart" sound + haptic. */
export function useAddToCart() {
  const { add } = useCart();
  const { playAddToCart } = useSounds();
  return (dish: Dish, quantity = 1) => {
    add(dish, quantity);
    playAddToCart();
  };
}

/** Round "+" button that pops when tapped. */
export function QuickAddButton({ dish }: { dish: Dish }) {
  const { colors } = useSettings();
  const addToCart = useAddToCart();
  const pop = useAnimatedValue(1);

  const onPress = () => {
    addToCart(dish);
    pop.setValue(0.6);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 18 }).start();
  };

  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Animated.View
        style={[
          styles.quickAdd,
          { backgroundColor: colors.primary, borderColor: colors.primaryDeep, transform: [{ scale: pop }] },
        ]}>
        <Emoji3D name="plus" size={22} />
      </Animated.View>
    </Pressable>
  );
}

export function DishCard({ dish, wide }: { dish: Dish; wide?: boolean }) {
  const { l, colors, formatPrice } = useSettings();
  const { getChef } = useCatalog();
  const chef = getChef(dish.chefId);
  return (
    <PressableScale onPress={() => router.push(`/dish/${dish.id}`)} style={wide ? undefined : { width: 190 }}>
      <Card3D style={{ padding: 0, overflow: 'hidden' }}>
        <View>
          <DishArt dish={dish} height={120} emojiSize={wide ? 84 : 92} color={chef?.color} />
          {(dish.spicy || dish.vegetarian || dish.allergens.length === 0) && (
            <View style={styles.badges}>
              {dish.spicy && <Emoji3D name="hot_pepper" size={22} />}
              {dish.vegetarian && <Emoji3D name="leaf" size={22} />}
              {dish.allergens.length === 0 && <Emoji3D name="check" size={22} />}
            </View>
          )}
        </View>
        <View style={{ padding: 12, gap: 2 }}>
          <Txt variant="heading" numberOfLines={1} style={{ fontSize: 17 }}>
            {l(dish.name)}
          </Txt>
          <Txt muted variant="caption" numberOfLines={2} style={{ minHeight: 34 }}>
            {l(dish.short)}
          </Txt>
          <View style={styles.priceRow}>
            <Txt style={{ fontWeight: '900', color: colors.primary }}>{formatPrice(dish.price)}</Txt>
            <QuickAddButton dish={dish} />
          </View>
        </View>
      </Card3D>
    </PressableScale>
  );
}

export function ChefCard({ chef, dishCount }: { chef: Chef; dishCount: number }) {
  const { l, t } = useSettings();
  const { ratings } = useCatalog();
  return (
    <PressableScale onPress={() => router.push(`/chef/${chef.id}`)}>
      <Card3D style={styles.chefCard} color={chef.color}>
        <ChefAvatar chef={chef} size={76} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="heading" color="#1E1B18">
            {l(chef.name)}
          </Txt>
          <Txt variant="caption" color="#5B4F48">
            {l(chef.specialty)} · {l(chef.area)}
          </Txt>
          <View style={styles.chefMeta}>
            <RatingBadge rating={ratings[chef.id]} color="#1E1B18" />
            <Emoji3D name="pot" size={18} style={{ marginStart: 8 }} />
            <Txt variant="caption" color="#1E1B18" style={{ fontWeight: '800' }}>
              {dishCount} {t('dishes')}
            </Txt>
          </View>
        </View>
      </Card3D>
    </PressableScale>
  );
}

export function AllergenList({ allergens }: { allergens: Allergen[] }) {
  const { t, colors } = useSettings();
  if (allergens.length === 0) {
    return (
      <Card3D style={[styles.noAllergens, { backgroundColor: colors.surfaceAlt }]}>
        <Emoji3D name="check" size={40} float />
        <View style={{ flex: 1 }}>
          <Txt style={{ fontWeight: '800', color: colors.success }}>{t('noAllergens')}</Txt>
          <Txt variant="caption" muted>
            {t('noAllergensBody')}
          </Txt>
        </View>
      </Card3D>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.row}>
        <Emoji3D name="warning" size={22} />
        <Txt style={{ fontWeight: '800', color: colors.danger }}>{t('containsAllergens')}:</Txt>
      </View>
      <View style={styles.allergenWrap}>
        {allergens.map((a) => (
          <View key={a} style={[styles.allergen, { backgroundColor: colors.surface, borderColor: colors.danger }]}>
            <Emoji3D name={ALLERGEN_EMOJI[a]} size={26} />
            <Txt style={{ fontWeight: '700' }}>{t(`al_${a}`)}</Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

export function FreeDeliveryBanner() {
  const { t, formatPrice } = useSettings();
  const { freeDeliveriesLeft } = useOrders();
  return (
    <LinearGradient
      colors={freeDeliveriesLeft > 0 ? ['#34B96B', '#1B7A43'] : ['#7A6F68', '#5B4F48']}
      style={styles.banner}>
      <Emoji3D name={freeDeliveriesLeft > 0 ? 'truck' : 'scooter'} size={56} float />
      <View style={{ flex: 1 }}>
        <Txt variant="heading" color="#fff">
          {freeDeliveriesLeft > 0 ? t('freeDeliveryTitle') : t('delivery')}
        </Txt>
        <Txt variant="caption" color="#EFFFF5">
          {freeDeliveriesLeft > 0
            ? t('freeDeliveryBanner', { n: freeDeliveriesLeft })
            : t('freeDeliveryUsed', { fee: formatPrice(DELIVERY_FEE) })}
        </Txt>
      </View>
      {freeDeliveriesLeft > 0 && (
        <View style={styles.bannerCount}>
          <Txt variant="title" color="#1B7A43" center style={{ fontSize: 22 }}>
            {freeDeliveriesLeft}
          </Txt>
        </View>
      )}
    </LinearGradient>
  );
}

export function QuantityStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { colors } = useSettings();
  return (
    <View style={[styles.stepper, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
      <Pressable onPress={() => onChange(value - 1)} hitSlop={6}>
        <Emoji3D name="minus" size={26} />
      </Pressable>
      <Txt style={{ fontWeight: '900', minWidth: 22 }} center>
        {value}
      </Txt>
      <Pressable onPress={() => onChange(value + 1)} hitSlop={6}>
        <Emoji3D name="plus" size={26} />
      </Pressable>
    </View>
  );
}

export { Button3D };

const styles = StyleSheet.create({
  badges: {
    position: 'absolute',
    top: 8,
    end: 8,
    gap: 2,
    padding: 2,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  quickAdd: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 4,
  },
  chefCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  chefMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  noAllergens: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  allergenWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  allergen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderBottomWidth: 3,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 22,
    borderBottomWidth: 5,
    borderBottomColor: 'rgba(0,0,0,0.2)',
  },
  bannerCount: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderBottomWidth: 3,
  },
});
