import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAnimatedValue } from '@/lib/useAnimatedValue';
import { Emoji3D } from '@/components/Emoji3D';
import { AllergenList, QuantityStepper, useAddToCart } from '@/components/menu';
import { Button3D, Card3D, EmptyState, Screen, Txt } from '@/components/ui';
import { getChef, getDish } from '@/data/menu';
import { EmojiName } from '@/lib/emoji';
import { useSettings } from '@/lib/settings';

export default function DishScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, l, colors, formatPrice } = useSettings();
  const addToCart = useAddToCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const bounce = useAnimatedValue(1);
  const dish = getDish(id);
  const chef = dish && getChef(dish.chefId);

  if (!dish || !chef)
    return (
      <Screen>
        <EmptyState emoji="warning" title={t('error')} />
      </Screen>
    );

  const onAdd = () => {
    addToCart(dish, quantity);
    setAdded(true);
    bounce.setValue(0.7);
    Animated.spring(bounce, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 20 }).start();
    setTimeout(() => setAdded(false), 1400);
  };

  const facts: { emoji: EmojiName; text: string }[] = [
    { emoji: 'stopwatch', text: `${dish.prepMinutes} ${t('prepTime')}` },
    { emoji: 'user', text: t('serves', { n: dish.serves }) },
    ...(dish.spicy ? [{ emoji: 'hot_pepper' as EmojiName, text: t('spicy') }] : []),
    ...(dish.vegetarian ? [{ emoji: 'leaf' as EmojiName, text: t('vegetarian') }] : []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={[styles.hero, { backgroundColor: chef.color }]}>
          <SafeAreaView edges={['top']} style={{ alignSelf: 'stretch' }}>
            <Pressable onPress={() => router.back()} style={styles.close} hitSlop={10}>
              <Emoji3D name="cross_mark" size={22} />
            </Pressable>
          </SafeAreaView>
          <Animated.View style={{ transform: [{ scale: bounce }] }}>
            <Emoji3D name={dish.emoji} size={190} float sway />
          </Animated.View>
        </View>

        <View style={{ padding: 20, gap: 16 }}>
          <View>
            <Txt variant="title">{l(dish.name)}</Txt>
            <Txt variant="heading" style={{ color: colors.primary, marginTop: 4 }}>
              {formatPrice(dish.price)}
            </Txt>
          </View>

          <View style={styles.facts}>
            {facts.map((f) => (
              <View
                key={f.text}
                style={[styles.fact, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <Emoji3D name={f.emoji} size={22} />
                <Txt variant="caption" style={{ fontWeight: '800' }}>
                  {f.text}
                </Txt>
              </View>
            ))}
          </View>

          <Pressable onPress={() => router.push(`/chef/${chef.id}`)}>
            <Card3D style={styles.chef} color={chef.color}>
              <Emoji3D name={chef.emoji} size={48} />
              <View style={{ flex: 1 }}>
                <Txt variant="caption" color="#5B4F48">
                  {t('cookedBy')}
                </Txt>
                <Txt style={{ fontWeight: '900' }} color="#1E1B18">
                  {l(chef.name)}
                </Txt>
              </View>
              <Emoji3D name="star" size={20} />
              <Txt style={{ fontWeight: '900' }} color="#1E1B18">
                {chef.rating.toFixed(1)}
              </Txt>
            </Card3D>
          </Pressable>

          <Section emoji="clipboard" title={t('description')}>
            <Txt style={{ fontSize: 16, lineHeight: 24 }}>{l(dish.description)}</Txt>
          </Section>

          <Section emoji="herb" title={t('ingredients')}>
            <Txt muted style={{ lineHeight: 22 }}>
              {l(dish.ingredients)}
            </Txt>
          </Section>

          <Section emoji="warning" title={t('allergies')}>
            <AllergenList allergens={dish.allergens} />
          </Section>
        </View>
      </ScrollView>

      <SafeAreaView
        edges={['bottom']}
        style={[styles.footer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <QuantityStepper value={quantity} onChange={(q) => setQuantity(Math.max(1, q))} />
        <Button3D
          title={added ? t('added') : `${t('addToCart')} · ${formatPrice(dish.price * quantity)}`}
          emoji={added ? 'check' : 'cart'}
          onPress={onAdd}
          style={{ flex: 1 }}
        />
      </SafeAreaView>
    </View>
  );
}

function Section({ emoji, title, children }: { emoji: EmojiName; title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Emoji3D name={emoji} size={26} />
        <Txt variant="heading">{title}</Txt>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingBottom: 24, borderBottomLeftRadius: 36, borderBottomRightRadius: 36 },
  close: {
    alignSelf: 'flex-end',
    marginEnd: 16,
    marginTop: 12,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.8)',
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
    borderBottomWidth: 3,
  },
  chef: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
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
