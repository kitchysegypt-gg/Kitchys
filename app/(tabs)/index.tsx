import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Animated, FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { CategoryBubbles, KitchenCard, PromoCarousel } from '@/components/home';
import { DishCard } from '@/components/menu';
import { Button, EmptyState, Icon, Screen, Txt } from '@/components/ui';
import { Category } from '@/data/menu';
import { DELIVERY_RADIUS_KM, useCatalog } from '@/lib/catalog';
import { FONT } from '@/lib/fonts';
import { useSettings } from '@/lib/settings';
import { formatTime, isKitchenOpen, nextOpening } from '@/lib/schedule';
import { useAnimatedValue } from '@/lib/useAnimatedValue';

export default function HomeScreen() {
  const { t, colors, isRTL, location } = useSettings();
  const { chefs, dishes, getChef } = useCatalog();
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dishes.filter((d) => {
      if (category !== 'all' && d.category !== category) return false;
      if (!q) return true;
      const chef = getChef(d.chefId);
      return [...Object.values(d.name), ...(chef ? Object.values(chef.name) : [])].some((s) =>
        s.toLowerCase().includes(q)
      );
    });
  }, [category, query, dishes, getChef]);

  const popular = dishes.filter((d) => d.popular);
  const browsing = query.trim() !== '' || category !== 'all';
  const noneNear = !!location && chefs.length === 0;

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => router.push('/location')} style={{ flex: 1 }} hitSlop={6}>
          <View style={styles.addressRow}>
            <Icon name="location" size={20} color={colors.primary} />
            <View style={{ flexShrink: 1 }}>
              <Txt variant="caption" muted style={{ fontSize: 12 }}>
                {t('deliveryTo')}
              </Txt>
              <View style={styles.addressRow}>
                <Txt numberOfLines={1} style={{ fontSize: 16, fontWeight: '700', flexShrink: 1 }}>
                  {location?.address || t('setLocation')}
                </Txt>
                <Icon name="chevron-down" size={16} color={colors.text} />
              </View>
            </View>
          </View>
        </Pressable>
        <Pressable onPress={() => router.push('/chat')} hitSlop={8} accessibilityLabel={t('chatTitle')}>
          <Icon name="k-chat" size={44} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => router.push('/settings')} hitSlop={8} accessibilityLabel={t('settings')}>
          <Icon name="k-settings" size={44} color={colors.text} />
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: 16 }}>
        <KitchenStatus />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={[styles.search, { backgroundColor: colors.surfaceAlt }]}>
          <Icon name="search" size={20} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text, textAlign: isRTL ? 'right' : 'left' }]}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Icon name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {noneNear ? (
          <EmptyState icon="location-outline" title={t('noChefsNear')} body={t('noChefsNearBody', { km: DELIVERY_RADIUS_KM })}>
            <Button title={t('changeAddress')} icon="map-outline" onPress={() => router.push('/location')} />
          </EmptyState>
        ) : (
          <>
            {!browsing && (
              <View style={{ marginTop: 16 }}>
                <PromoCarousel />
              </View>
            )}

            <CategoryBubbles value={category} onChange={setCategory} />

            {browsing ? (
              <View style={{ marginTop: 14 }}>
                {filtered.length === 0 ? (
                  <EmptyState icon="search" title={t('noResults')} />
                ) : (
                  <View style={styles.grid}>
                    {filtered.map((d) => (
                      <View key={d.id} style={styles.gridItem}>
                        <DishCard dish={d} wide />
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <>

                {sectionHeader(t('kitchensNearYou'), () => router.navigate('/chefs'))}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingVertical: 8 }}>
                  {chefs.map((c) => (
                    <KitchenCard key={c.id} chef={c} />
                  ))}
                </ScrollView>

                {sectionHeader(t('popularDishes'))}
                <FlatList
                  horizontal
                  data={popular}
                  keyExtractor={(d) => d.id}
                  renderItem={({ item }) => <DishCard dish={item} />}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingVertical: 8 }}
                />

                {sectionHeader(t('allDishes'))}
                <View style={styles.grid}>
                  {dishes.map((d) => (
                    <View key={d.id} style={styles.gridItem}>
                      <DishCard dish={d} wide />
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );

  function sectionHeader(title: string, onSeeAll?: () => void) {
    return (
      <View style={styles.sectionHeader}>
        <Txt variant="heading" style={{ flex: 1, fontSize: 19 }}>
          {title}
        </Txt>
        {onSeeAll && (
          <Pressable onPress={onSeeAll} hitSlop={8} style={styles.seeAll}>
            <Txt style={{ color: colors.primary, fontWeight: '600' }}>{t('seeAll')}</Txt>
            <Icon name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.primary} />
          </Pressable>
        )}
      </View>
    );
  }
}

/** "Kitchens open · 45 - 60 min" with a softly pulsing live dot. */
function KitchenStatus() {
  const { t, colors, language } = useSettings();
  const pulse = useAnimatedValue(0);
  // Re-check every minute so the pill flips at 10 AM and 9 PM.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const open = isKitchenOpen(now);
  const dot = open ? colors.success : colors.danger;
  const opening = nextOpening(now);
  const opensText = t(opening.day === 0 ? 'opensAt' : 'opensTomorrow', { time: formatTime(opening.minutes, language) });
  return (
    <View style={[styles.status, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={styles.pulseWrap}>
        {open && (
          <Animated.View
            style={[
              styles.pulseRing,
              {
                backgroundColor: dot,
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2] }) }],
              },
            ]}
          />
        )}
        <View style={[styles.pulseDot, { backgroundColor: dot }]} />
      </View>
      <Txt variant="caption" style={{ fontWeight: '600' }}>
        {open ? t('kitchensOpen') : t('kitchensClosed')}
      </Txt>
      {open ? (
        <>
          <Icon name="delivery" size={16} color={colors.primary} />
          <Txt variant="caption" style={{ fontWeight: '600', color: colors.primary }}>
            {t('deliveryWindow')}
          </Txt>
        </>
      ) : (
        <Txt variant="caption" style={{ fontWeight: '600', color: colors.primary }}>
          · {opensText}
        </Txt>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 6,
    paddingVertical: 5,
    paddingStart: 8,
    paddingEnd: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  pulseWrap: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  pulseDot: { width: 6, height: 6, borderRadius: 3 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  searchInput: { flex: 1, paddingVertical: 13, fontSize: 15, fontFamily: FONT.regular },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 26, marginBottom: 12 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12, paddingHorizontal: 16 },
  gridItem: { width: '48.5%' },
});
