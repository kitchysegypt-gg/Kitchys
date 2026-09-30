import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Emoji3D } from '@/components/Emoji3D';
import { ChefCard, DishCard, FreeDeliveryBanner } from '@/components/menu';
import { Chip, EmptyState, Icon, PressableScale, Screen, Txt } from '@/components/ui';
import { CATEGORIES, Category } from '@/data/menu';
import { useCatalog } from '@/lib/catalog';
import { useSettings } from '@/lib/settings';

// Soft tile colours for the category grid, in CATEGORIES order (after "All").
const TILE_COLORS = ['#FDE8DA', '#FBF1D9', '#DDEFF6', '#FBE3EA', '#E3F3E6'];

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
          <View style={styles.addressRow}>
            <Txt
              numberOfLines={1}
              style={{ color: colors.primary, fontSize: 20, fontWeight: '700', flexShrink: 1 }}>
              {location?.address || t('setLocation')}
            </Txt>
            <Icon name="chevron-down" size={18} color={colors.primary} />
          </View>
          <View style={styles.etaRow}>
            <Txt style={{ fontSize: 16, fontWeight: '500' }}>{t('deliveryIn')}</Txt>
            <View style={[styles.eta, { backgroundColor: colors.successBg }]}>
              <Txt style={{ color: colors.success, fontWeight: '600', fontSize: 15 }}>{t('deliveryWindow')}</Txt>
            </View>
          </View>
        </Pressable>
        <Pressable onPress={() => router.push('/chat')} hitSlop={8} accessibilityLabel={t('chatTitle')}>
          <Icon name="chatbox-ellipses-outline" size={27} color={colors.primary} />
        </Pressable>
        <Pressable onPress={() => router.push('/rewards')} hitSlop={8} accessibilityLabel={t('tabRewards')}>
          <Icon name="gift-outline" size={27} color={colors.primary} />
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

        {browsing ? (
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
              <FreeDeliveryBanner />
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
              {tiles.map((c, i) => (
                <PressableScale key={c.id} onPress={() => setCategory(c.id)} style={styles.tileWrap}>
                  <View style={[styles.tile, { backgroundColor: TILE_COLORS[i % TILE_COLORS.length] }]}>
                    <Txt center color="#1B1B1F" style={{ fontWeight: '600', fontSize: 15 }}>
                      {t(c.label)}
                    </Txt>
                    <Emoji3D name={c.emoji} size={62} style={styles.tileArt} />
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
        <Txt variant="title" style={{ flex: 1, fontSize: 22 }}>
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

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  etaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  eta: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
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
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15 },
  chips: { gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 26, marginBottom: 12 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12, paddingHorizontal: 16 },
  gridItem: { width: '48.5%' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  tileWrap: { width: '31%' },
  tile: { height: 132, borderRadius: 18, paddingTop: 12, paddingHorizontal: 8, overflow: 'hidden' },
  tileArt: { position: 'absolute', bottom: 8, end: 8 },
});
