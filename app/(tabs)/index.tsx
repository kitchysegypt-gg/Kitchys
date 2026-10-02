import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Animated, FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { CategoryPhoto } from '@/components/media';
import { ChefCard, DishCard, FreeDeliveryBanner } from '@/components/menu';
import { Button, Chip, EmptyState, Icon, PressableScale, Screen, Txt } from '@/components/ui';
import { CATEGORIES, Category } from '@/data/menu';
import { DELIVERY_RADIUS_KM, useCatalog } from '@/lib/catalog';
import { FONT } from '@/lib/fonts';
import { useSettings } from '@/lib/settings';
import { useAnimatedValue } from '@/lib/useAnimatedValue';

export default function HomeScreen() {
  const { t, colors, isRTL, location } = useSettings();
  const { chefs, dishes, dishesByChef, getChef } = useCatalog();
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
  const tiles = CATEGORIES.filter((c) => c.id !== 'all');

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => router.push('/location')} style={{ flex: 1 }} hitSlop={6}>
          <Txt variant="caption" muted style={{ fontWeight: '500' }}>
            {t('deliverTo')}
          </Txt>
          <View style={styles.addressRow}>
            <Icon name="location" size={16} color={colors.primary} />
            <Txt numberOfLines={1} style={{ fontSize: 16, fontWeight: '700', flexShrink: 1 }}>
              {location?.address || t('setLocation')}
            </Txt>
            <Icon name="chevron-down" size={16} color={colors.textMuted} />
          </View>
          <KitchenStatus />
        </Pressable>
        <Pressable
          onPress={() => router.push('/chat')}
          hitSlop={8}
          accessibilityLabel={t('chatTitle')}
          style={[styles.headerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="chatbubble-ellipses-outline" size={21} />
        </Pressable>
        <Pressable
          onPress={() => router.push('/rewards')}
          hitSlop={8}
          accessibilityLabel={t('tabRewards')}
          style={[styles.headerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="gift-outline" size={21} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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

        {location && chefs.length === 0 ? (
          <EmptyState icon="location-outline" title={t('noChefsNear')} body={t('noChefsNearBody', { km: DELIVERY_RADIUS_KM })}>
            <Button title={t('changeAddress')} icon="map-outline" onPress={() => router.push('/location')} />
          </EmptyState>
        ) : browsing ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {CATEGORIES.map((c) => (
                <Chip
                  key={c.id}
                  label={t(c.label)}
                  emoji={c.id === 'all' ? undefined : c.emoji}
                  active={category === c.id}
                  onPress={() => setCategory(c.id)}
                />
              ))}
            </ScrollView>
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
          </>
        ) : (
          <>
            <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
              <FreeDeliveryBanner showPoints />
            </View>

            {sectionHeader(t('popularDishes'))}
            <FlatList
              horizontal
              data={popular}
              keyExtractor={(d) => d.id}
              renderItem={({ item }) => <DishCard dish={item} />}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 4 }}
            />

            {sectionHeader(t('categories'))}
            <View style={styles.tiles}>
              {tiles.map((c) => (
                <PressableScale key={c.id} onPress={() => setCategory(c.id)} style={styles.tileWrap}>
                  <View style={[styles.tile, { backgroundColor: colors.surfaceAlt }]}>
                    <CategoryPhoto category={c.id as Category} />
                    <LinearGradient
                      colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.68)']}
                      locations={[0.35, 1]}
                      style={StyleSheet.absoluteFill}
                    />
                    <Txt numberOfLines={1} color="#FFFFFF" style={styles.tileLabel}>
                      {t(c.label)}
                    </Txt>
                  </View>
                </PressableScale>
              ))}
            </View>

            {sectionHeader(t('homeChefs'), () => router.navigate('/chefs'))}
            <View style={{ paddingHorizontal: 16, gap: 10 }}>
              {chefs.slice(0, 3).map((c) => (
                <ChefCard key={c.id} chef={c} dishCount={dishesByChef(c.id).length} />
              ))}
            </View>

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
      </ScrollView>
    </Screen>
  );

  function sectionHeader(title: string, onSeeAll?: () => void) {
    return (
      <View style={styles.sectionHeader}>
        <Txt variant="heading" style={{ flex: 1, fontSize: 20 }}>
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
  const { t, colors } = useSettings();
  const pulse = useAnimatedValue(0);
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={[styles.status, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={styles.pulseWrap}>
        <Animated.View
          style={[
            styles.pulseRing,
            {
              backgroundColor: colors.success,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2] }) }],
            },
          ]}
        />
        <View style={[styles.pulseDot, { backgroundColor: colors.success }]} />
      </View>
      <Txt variant="caption" style={{ fontWeight: '600' }}>
        {t('kitchensOpen')}
      </Txt>
      <Icon name="delivery" size={16} color={colors.primary} />
      <Txt variant="caption" style={{ fontWeight: '600', color: colors.primary }}>
        {t('deliveryWindow')}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    marginTop: 6,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, fontFamily: FONT.regular },
  chips: { gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 26, marginBottom: 12 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12, paddingHorizontal: 16 },
  gridItem: { width: '48.5%' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  tileWrap: { width: '31%' },
  tile: { height: 132, borderRadius: 18, overflow: 'hidden', justifyContent: 'flex-end' },
  tileLabel: { fontWeight: '700', fontSize: 15, paddingHorizontal: 10, paddingBottom: 10 },
});
