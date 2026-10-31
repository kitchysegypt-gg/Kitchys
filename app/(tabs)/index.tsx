import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { setStatusBarStyle } from 'expo-status-bar';
import { Animated, FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryBubbles, KitchenCard, PromoCarousel } from '@/components/home';
import { Greeting, TonightHero } from '@/components/hungry';
import { DishCard } from '@/components/menu';
import { Button, Card, EmptyState, Icon, IconBadge, Screen, Txt } from '@/components/ui';
import { Category } from '@/data/menu';
import { useAddresses } from '@/lib/addresses';
import { DELIVERY_RADIUS_KM, useCatalog } from '@/lib/catalog';
import { FONT } from '@/lib/fonts';
import { useSettings } from '@/lib/settings';
import { formatTime, nextOpening } from '@/lib/schedule';
import { useKitchensOpen, useTonight } from '@/lib/tonight';
import { useAnimatedValue } from '@/lib/useAnimatedValue';

const HOME_WAVES = require('@/assets/images/home-waves.png');
const LOGO_MARK = require('@/assets/images/logo-mark.png');

export default function HomeScreen() {
  const { t, colors, isRTL, location } = useSettings();
  const { chefs, dishes, deals, popular, getChef } = useCatalog();
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

  const browsing = query.trim() !== '' || category !== 'all';
  const insets = useSafeAreaInsets();
  // White status bar text over the orange waves while Home is showing.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle(colors.dark ? 'light' : 'dark');
    }, [colors.dark])
  );
  const tonight = useTonight();
  const { addresses } = useAddresses();
  const noneNear = !!location && chefs.length === 0;

  return (
    <Screen edges={[]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* Kitchy's waves from the loading screen, with the address, greeting and search on them. */}
        <View style={[styles.waveTop, { paddingTop: insets.top + 10, backgroundColor: '#F4511E' }]}>
          <Image source={HOME_WAVES} style={styles.waveEdge} contentFit="fill" />
          <View style={styles.header}>
            <View style={styles.markTile}>
              <Image source={LOGO_MARK} style={{ width: 28, height: 30 }} contentFit="contain" />
            </View>
            <Pressable
              onPress={() => router.push(addresses.length ? '/addresses' : '/location')}
              style={{ flex: 1 }}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`${t('deliveryTo')} ${location?.address || t('setLocation')}`}>
              <View style={styles.addressRow}>
                <Txt numberOfLines={1} style={{ fontSize: 16, fontWeight: '700', flexShrink: 1 }} color="#FFFFFF">
                  {location?.address || t('setLocation')}
                </Txt>
                <Icon name="chevron-down" size={16} color="#FFFFFF" />
              </View>
              <KitchenStatus />
            </Pressable>
            <Pressable onPress={() => router.push('/chat')} hitSlop={8} accessibilityLabel={t('chatTitle')}>
              <Icon name="k-chat" size={40} />
            </Pressable>
          </View>
          {!browsing && <Greeting light />}
        <View style={styles.search}>
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
        </View>

        {noneNear ? (
          <EmptyState icon="location-outline" title={t('noChefsNear')} body={t('noChefsNearBody', { km: DELIVERY_RADIUS_KM })}>
            <Button title={t('changeAddress')} icon="map-outline" onPress={() => router.push('/location')} />
          </EmptyState>
        ) : (
          <>
            {/* Closed for the night: the greeting already says so. Sold out: say that instead of Tonight's dinner. */}
            {!browsing && tonight.reason === 'soldOut' ? <SoldOutNotice /> : !browsing && <TonightHero />}
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

                {deals.length > 0 && (
                  <>
                    {sectionHeader(t('todaysDeals'))}
                    <Txt variant="caption" muted style={{ paddingHorizontal: 16, marginTop: -6 }}>
                      {t('todaysDealsBody')}
                    </Txt>
                    <FlatList
                      horizontal
                      data={deals}
                      keyExtractor={(d) => d.id}
                      renderItem={({ item }) => <DishCard dish={item} />}
                      showsHorizontalScrollIndicator={false}
                      style={styles.row}
                      contentContainerStyle={styles.rowContent}
                    />
                  </>
                )}

                {sectionHeader(t('kitchensNearYou'), () => router.navigate('/chefs'))}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.row}
                  contentContainerStyle={styles.rowContent}>
                  {chefs.map((c) => (
                    <KitchenCard key={c.id} chef={c} />
                  ))}
                </ScrollView>

                {/* Only once enough dishes have real orders; an empty row looks broken. */}
                {popular.length > 0 && (
                  <>
                    {sectionHeader(t('popularDishes'))}
                    <FlatList
                      horizontal
                      data={popular}
                      keyExtractor={(d) => d.id}
                      renderItem={({ item }) => <DishCard dish={item} />}
                      showsHorizontalScrollIndicator={false}
                      style={styles.row}
                      contentContainerStyle={styles.rowContent}
                    />
                  </>
                )}

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
        <Txt variant="heading" style={{ flex: 1, fontSize: 22 }}>
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

/** Every dinner near the customer is sold out tonight: a plain notice, no button. */
function SoldOutNotice() {
  const { t } = useSettings();
  return (
    <Card style={styles.tomorrow}>
      <View style={styles.tomorrowHead}>
        <IconBadge name="information-circle-outline" tone="orange" size={42} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt style={{ fontWeight: '800', fontSize: 16 }}>{t('soldOutTonightTitle')}</Txt>
          <Txt variant="caption" muted>
            {t('soldOutNoticeBody')}
          </Txt>
        </View>
      </View>
    </Card>
  );
}

/** "● Kitchens open · 45–60 min" under the address, with a softly pulsing live dot. */
function KitchenStatus() {
  const { t, language } = useSettings();
  const pulse = useAnimatedValue(0);
  // Re-check every minute so the line flips at 10 AM and 9 PM.
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
  const open = useKitchensOpen(now);
  const dot = open ? '#7DF0A5' : '#FFD2C2';
  const opening = nextOpening(now);
  const opensText = t(opening.day === 0 ? 'opensAt' : 'opensTomorrow', { time: formatTime(opening.minutes, language) });
  return (
    <View style={styles.status}>
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
      <Txt variant="caption" numberOfLines={1} style={{ fontSize: 12, flexShrink: 1 }} color="#FFE9DF">
        {open ? `${t('kitchensOpen')} · ${t('deliveryWindow')}` : `${t('kitchensClosed')} · ${opensText}`}
      </Txt>
    </View>
  );
}

const SHADOW_ROOM = 22;

const styles = StyleSheet.create({
  // Solid orange, ending in the orange and amber waves of the loading screen.
  waveTop: { paddingBottom: 56 },
  waveEdge: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 122 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 4 },
  markTile: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, paddingStart: 2 },
  pulseWrap: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  pulseDot: { width: 6, height: 6, borderRadius: 3 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
  },
  searchInput: { flex: 1, paddingVertical: 13, fontSize: 15, fontFamily: FONT.regular },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 26, marginBottom: 12 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  // Android cuts a scroll row's content at its edges, so the card shadow needs room below the
  // cards or it ends in a hard grey line; the negative margin keeps the spacing the same.
  row: { marginBottom: -SHADOW_ROOM },
  rowContent: { paddingHorizontal: 16, gap: 12, paddingTop: 8, paddingBottom: 8 + SHADOW_ROOM },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12, paddingHorizontal: 16 },
  gridItem: { width: '48.5%' },
  tomorrow: { marginHorizontal: 16, marginTop: 14, gap: 12 },
  tomorrowHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
