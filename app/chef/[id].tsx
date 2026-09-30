import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Emoji3D } from '@/components/Emoji3D';
import { ChefAvatar, Stars } from '@/components/media';
import { DishCard } from '@/components/menu';
import { Card3D, EmptyState, Screen, Txt } from '@/components/ui';
import { useCatalog } from '@/lib/catalog';
import { RATING_PARTS, Review, fetchChefReviews } from '@/lib/reviews';
import { useSettings } from '@/lib/settings';

export default function ChefScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, l, colors, language } = useSettings();
  const { getChef, dishesByChef, ratings, refresh } = useCatalog();
  const [reviews, setReviews] = useState<Review[]>([]);
  const chef = getChef(id);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      fetchChefReviews(id)
        .then(setReviews)
        .catch(() => setReviews([]));
      refresh();
    }, [id, refresh])
  );

  if (!chef)
    return (
      <Screen>
        <EmptyState emoji="warning" title={t('error')} />
      </Screen>
    );
  const dishes = dishesByChef(chef.id);
  const rating = ratings[chef.id];
  const locale = language === 'ar' ? 'ar-EG' : language;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={[styles.hero, { backgroundColor: chef.color }]}>
          <SafeAreaView edges={['top']} style={{ alignSelf: 'stretch' }}>
            <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10}>
              <Txt style={{ fontSize: 22, fontWeight: '900' }} color="#1E1B18">
                ←
              </Txt>
            </Pressable>
          </SafeAreaView>
          <ChefAvatar chef={chef} size={150} />
          <Txt variant="title" color="#1E1B18" center>
            {l(chef.name)}
          </Txt>
          <Txt color="#5B4F48" center style={{ fontWeight: '700' }}>
            {l(chef.specialty)} · {l(chef.area)}
          </Txt>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Emoji3D name={rating ? 'star' : 'sparkles'} size={24} />
              <Txt color="#1E1B18" style={{ fontWeight: '900' }}>
                {rating
                  ? `${rating.overall.toFixed(1)} · ${t('reviewsCount', { n: rating.review_count })}`
                  : t('newChef')}
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
          {!!l(chef.bio) && (
            <Txt muted style={{ fontSize: 16, lineHeight: 24 }}>
              {l(chef.bio)}
            </Txt>
          )}
          <View style={styles.sectionTitle}>
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

          <View style={styles.sectionTitle}>
            <Emoji3D name="star" size={28} />
            <Txt variant="heading">{t('reviews')}</Txt>
          </View>

          {rating ? (
            <Card3D style={{ gap: 10 }}>
              {RATING_PARTS.map((part) => {
                const value = rating[part.key];
                return (
                  <View key={part.key} style={styles.ratingRow}>
                    <Emoji3D name={part.emoji} size={22} />
                    <Txt style={{ flex: 1, fontWeight: '700' }}>{t(part.label)}</Txt>
                    <View style={[styles.bar, { backgroundColor: colors.surfaceAlt }]}>
                      <View
                        style={[styles.barFill, { width: `${(value / 5) * 100}%`, backgroundColor: colors.primary }]}
                      />
                    </View>
                    <Txt style={styles.score}>{value.toFixed(1)}</Txt>
                  </View>
                );
              })}
            </Card3D>
          ) : (
            <Txt muted>{t('noReviews')}</Txt>
          )}

          {reviews.map((r) => (
            <Card3D key={r.id} style={{ gap: 6 }}>
              <View style={styles.reviewHead}>
                <Emoji3D name="user" size={28} />
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontWeight: '800' }}>{r.reviewer_name || t('customer')}</Txt>
                  <Txt variant="caption" muted>
                    {new Date(r.created_at).toLocaleDateString(locale, { dateStyle: 'medium' })}
                  </Txt>
                </View>
                <Stars value={(r.food + r.delivery + r.packaging + r.value) / 4} size={16} />
              </View>
              <View style={styles.reviewParts}>
                {RATING_PARTS.map((part) => (
                  <Txt key={part.key} variant="caption" muted>
                    {t(part.label)} {r[part.key]}/5
                  </Txt>
                ))}
              </View>
              {!!r.comment && <Txt>{r.comment}</Txt>}
            </Card3D>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: 6,
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
  stats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 10 },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.75)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bar: { width: 90, height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  score: { width: 32, textAlign: 'right', fontWeight: '900', fontVariant: ['tabular-nums'] },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewParts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 },
});
