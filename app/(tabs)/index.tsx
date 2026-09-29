import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Emoji3D } from '@/components/Emoji3D';
import { ChefCard, DishCard, FreeDeliveryBanner } from '@/components/menu';
import { Chip, Screen, Txt } from '@/components/ui';
import { CATEGORIES, CHEFS, Category, DISHES, dishesByChef, getChef } from '@/data/menu';
import { useAuth } from '@/lib/auth';
import { useOrders } from '@/lib/orders';
import { useSettings } from '@/lib/settings';

export default function HomeScreen() {
  const { t, colors, isRTL, location } = useSettings();
  const { session } = useAuth();
  const { points, rank } = useOrders();
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [query, setQuery] = useState('');

  const firstName = (session?.user.user_metadata?.full_name as string | undefined)?.split(' ')[0];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DISHES.filter((d) => {
      if (category !== 'all' && d.category !== category) return false;
      if (!q) return true;
      const chef = getChef(d.chefId);
      return [...Object.values(d.name), ...(chef ? Object.values(chef.name) : [])].some((s) =>
        s.toLowerCase().includes(q)
      );
    });
  }, [category, query]);

  const popular = DISHES.filter((d) => d.popular);
  const browsing = query.trim() !== '' || category !== 'all';

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.push('/location')}
            style={[styles.deliverTo, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Emoji3D name="pin" size={26} />
            <View style={{ flex: 1 }}>
              <Txt variant="caption" muted>
                {t('deliverTo')}
              </Txt>
              <Txt style={{ fontWeight: '800' }} numberOfLines={1}>
                {location?.address || t('setLocation')}
              </Txt>
            </View>
          </Pressable>
          <Pressable
            onPress={() => router.navigate('/rewards')}
            style={[styles.pointsChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Emoji3D name={rank.emoji} size={24} />
            <Txt style={{ fontWeight: '900', color: colors.primary, fontVariant: ['tabular-nums'] }}>{points}</Txt>
          </Pressable>
        </View>

        <LinearGradient colors={colors.heroGradient} style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Txt color="#FFE9DF" style={{ fontWeight: '700' }}>
              {t('hello')}
              {firstName ? `, ${firstName}` : ''} 👋
            </Txt>
            <Txt variant="title" color="#fff" style={{ fontSize: 26 }}>
              {t('whatToEat')}
            </Txt>
          </View>
          <Emoji3D name="cooking" size={96} float />
        </LinearGradient>

        <View
          style={[
            styles.search,
            { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow },
          ]}>
          <Emoji3D name="search" size={26} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text, textAlign: isRTL ? 'right' : 'left' }]}
          />
        </View>

        <View style={{ paddingHorizontal: 20, marginTop: 18 }}>
          <FreeDeliveryBanner />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {CATEGORIES.map((c) => (
            <Chip
              key={c.id}
              label={t(c.label)}
              emoji={c.emoji}
              active={category === c.id}
              onPress={() => setCategory(c.id)}
            />
          ))}
        </ScrollView>

        {browsing ? (
          <View style={styles.grid}>
            {filtered.length === 0 ? (
              <View style={{ alignItems: 'center', width: '100%', padding: 30 }}>
                <Emoji3D name="search" size={80} float sway />
                <Txt muted style={{ marginTop: 10 }}>
                  {t('noResults')}
                </Txt>
              </View>
            ) : (
              filtered.map((d) => (
                <View key={d.id} style={{ width: '48%' }}>
                  <DishCard dish={d} wide />
                </View>
              ))
            )}
          </View>
        ) : (
          <>
            {sectionHeader(t('popularDishes'), 'fire')}
            <FlatList
              horizontal
              data={popular}
              keyExtractor={(d) => d.id}
              renderItem={({ item }) => <DishCard dish={item} />}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 10 }}
            />

            {sectionHeader(t('homeChefs'), 'heart', () => router.push('/chefs'))}
            <View style={{ paddingHorizontal: 20, gap: 14 }}>
              {CHEFS.slice(0, 3).map((c) => (
                <ChefCard key={c.id} chef={c} dishCount={dishesByChef(c.id).length} />
              ))}
            </View>

            {sectionHeader(t('catAll'), 'sparkles')}
            <View style={styles.grid}>
              {DISHES.map((d) => (
                <View key={d.id} style={{ width: '48%' }}>
                  <DishCard dish={d} wide />
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );

  function sectionHeader(title: string, emoji: 'fire' | 'heart' | 'sparkles', onSeeAll?: () => void) {
    return (
      <View style={styles.sectionHeader}>
        <Emoji3D name={emoji} size={28} />
        <Txt variant="heading" style={{ flex: 1 }}>
          {title}
        </Txt>
        {onSeeAll && (
          <Pressable onPress={onSeeAll} hitSlop={8}>
            <Txt style={{ color: colors.primary, fontWeight: '800' }}>{t('seeAll')}</Txt>
          </Pressable>
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12 },
  deliverTo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 3,
  },
  pointsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 3,
  },
  hero: {
    margin: 20,
    marginTop: 14,
    marginBottom: 0,
    padding: 20,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 6,
    borderBottomColor: 'rgba(0,0,0,0.18)',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 16,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: { flex: 1, paddingVertical: 14, fontSize: 16 },
  chips: { gap: 8, paddingHorizontal: 20, paddingVertical: 16 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    marginTop: 14,
    marginBottom: 12,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14, paddingHorizontal: 20 },
});
