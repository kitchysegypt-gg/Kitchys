import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAnimatedValue } from '@/lib/useAnimatedValue';
import { AllergenList, QuantityStepper, useAddToCart } from '@/components/menu';
import { Button, Card, EmptyState, Icon, IconName, Screen, Txt } from '@/components/ui';
import { ChefAvatar, DishGallery, RatingBadge } from '@/components/media';
import { formatPortion } from '@/data/menu';
import { useCatalog } from '@/lib/catalog';
import { useSettings } from '@/lib/settings';

export default function DishScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, l, colors, formatPrice } = useSettings();
  const addToCart = useAddToCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const bounce = useAnimatedValue(1);
  const { getChef, getDish, ratings, portionsLeft } = useCatalog();
  const dish = getDish(id);
  const chef = dish && getChef(dish.chefId);
  const left = dish ? portionsLeft(dish) : null;

  if (!dish || !chef)
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title={t('error')} />
      </Screen>
    );

  const onAdd = () =>
    addToCart(dish, quantity, () => {
      setAdded(true);
      bounce.setValue(0.97);
      Animated.spring(bounce, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();
      setTimeout(() => setAdded(false), 1400);
    });

  const facts: { icon: IconName; text: string; color?: string }[] = [
    { icon: 'time-outline', text: `${dish.prepMinutes} ${t('prepTime')}` },
    { icon: 'people-outline', text: t('serves', { n: dish.serves }) },
    ...(dish.portionGrams ? [{ icon: 'scale-outline' as IconName, text: formatPortion(dish.portionGrams) }] : []),
    ...(dish.spicy ? [{ icon: 'flame' as IconName, text: t('spicy'), color: '#E53935' }] : []),
    ...(dish.vegetarian ? [{ icon: 'leaf' as IconName, text: t('vegetarian'), color: '#2E9E5B' }] : []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={styles.photoHero}>
          <Animated.View style={{ transform: [{ scale: bounce }] }}>
            <DishGallery dish={dish} height={320} />
          </Animated.View>
          <SafeAreaView edges={['top']} style={styles.photoClose}>
            <Pressable onPress={() => router.back()} style={styles.close} hitSlop={10}>
              <Icon name="close" size={22} color="#1B1B1F" />
            </Pressable>
          </SafeAreaView>
        </View>

        <View style={{ padding: 20, gap: 16 }}>
          <View>
            <Txt variant="title">{l(dish.name)}</Txt>
            <Txt variant="heading" style={{ marginTop: 4, color: colors.primary }}>
              {formatPrice(dish.price)}
              {dish.deal ? (
                <Txt muted style={{ fontSize: 15, textDecorationLine: 'line-through' }}>
                  {'  '}
                  {formatPrice(dish.deal.originalPrice)}
                </Txt>
              ) : null}
            </Txt>
            {dish.deal && (
              <Txt variant="caption" style={{ marginTop: 4, fontWeight: '700', color: colors.primary }}>
                🔥 {t('dealDetail', { n: dish.deal.left })}
              </Txt>
            )}
            {left !== null && left <= 5 && (
              <Txt variant="caption" style={{ marginTop: 4, fontWeight: '700', color: left === 0 ? colors.danger : colors.primary }}>
                {left === 0 ? t('soldOutToday') : t('onlyLeftToday', { n: left })}
              </Txt>
            )}
          </View>

          <View style={styles.facts}>
            {facts.map((f) => (
              <View
                key={f.text}
                style={[styles.fact, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Icon name={f.icon} size={16} color={f.color ?? colors.textMuted} />
                <Txt variant="caption" style={{ fontWeight: '600' }}>
                  {f.text}
                </Txt>
              </View>
            ))}
          </View>

          <Pressable onPress={() => router.push(`/chef/${chef.id}`)}>
            <Card style={styles.chef}>
              <ChefAvatar chef={chef} size={48} />
              <View style={{ flex: 1 }}>
                <Txt variant="caption" muted>
                  {t('cookedBy')}
                </Txt>
                <Txt style={{ fontWeight: '700' }}>{l(chef.name)}</Txt>
              </View>
              <RatingBadge rating={ratings[chef.id]} color={colors.text} />
            </Card>
          </Pressable>

          <Section title={t('description')}>
            <Txt style={{ fontSize: 16, lineHeight: 24 }}>{l(dish.description)}</Txt>
          </Section>

          <Section title={t('ingredients')}>
            <Txt muted style={{ lineHeight: 22 }}>
              {l(dish.ingredients)}
            </Txt>
          </Section>

          <Section title={t('allergies')}>
            <AllergenList allergens={dish.allergens} />
          </Section>
        </View>
      </ScrollView>

      <SafeAreaView
        edges={['bottom']}
        style={[styles.footer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <QuantityStepper value={quantity} onChange={(q) => setQuantity(Math.max(1, q))} />
        <Button
          title={added ? t('added') : `${t('addToCart')} · ${formatPrice(dish.price * quantity)}`}
          icon={added ? 'checkmark' : 'cart-outline'}
          onPress={onAdd}
          style={{ flex: 1 }}
        />
      </SafeAreaView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Txt variant="heading">{title}</Txt>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  photoHero: { height: 320, overflow: 'hidden' },
  photoClose: { position: 'absolute', top: 0, right: 0 },
  close: {
    alignSelf: 'flex-end',
    marginEnd: 16,
    marginTop: 12,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  chef: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
});
