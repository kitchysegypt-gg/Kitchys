import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Emoji3D } from '@/components/Emoji3D';
import { DishCard } from '@/components/menu';
import { EmptyState, Screen, Txt } from '@/components/ui';
import { dishesByChef, getChef } from '@/data/menu';
import { useSettings } from '@/lib/settings';

export default function ChefScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, l, colors } = useSettings();
  const chef = getChef(id);

  if (!chef)
    return (
      <Screen>
        <EmptyState emoji="warning" title={t('error')} />
      </Screen>
    );
  const dishes = dishesByChef(chef.id);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={[styles.hero, { backgroundColor: chef.color }]}>
          <SafeAreaView edges={['top']}>
            <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10}>
              <Txt style={{ fontSize: 22, fontWeight: '900' }} color="#1E1B18">
                ←
              </Txt>
            </Pressable>
          </SafeAreaView>
          <Emoji3D name={chef.emoji} size={150} float />
          <Txt variant="title" color="#1E1B18" center>
            {l(chef.name)}
          </Txt>
          <Txt color="#5B4F48" center style={{ fontWeight: '700' }}>
            {l(chef.specialty)} · {l(chef.area)}
          </Txt>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Emoji3D name="star" size={24} />
              <Txt color="#1E1B18" style={{ fontWeight: '900' }}>
                {chef.rating.toFixed(1)}
              </Txt>
            </View>
            <View style={styles.stat}>
              <Emoji3D name="pot" size={24} />
              <Txt color="#1E1B18" style={{ fontWeight: '900' }}>
                {dishes.length} {t('dishes')}
              </Txt>
            </View>
          </View>
        </View>

        <View style={{ padding: 20, gap: 14 }}>
          <Txt muted style={{ fontSize: 16, lineHeight: 24 }}>
            {l(chef.bio)}
          </Txt>
          <View style={styles.menuTitle}>
            <Emoji3D name="clipboard" size={28} />
            <Txt variant="heading">{t('menu')}</Txt>
          </View>
          <View style={styles.grid}>
            {dishes.map((d) => (
              <View key={d.id} style={{ width: '48%' }}>
                <DishCard dish={d} wide />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  back: {
    alignSelf: 'flex-start',
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  stats: { flexDirection: 'row', gap: 12, marginTop: 14 },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.75)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  menuTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
});
