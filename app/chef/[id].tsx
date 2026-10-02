import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChefAvatar, ChefTags, Stars } from '@/components/media';
import { DishCard } from '@/components/menu';
import { Card, EmptyState, Icon, Screen, Txt } from '@/components/ui';
import { DELIVERY_RADIUS_KM, useCatalog } from '@/lib/catalog';
import { RATING_PARTS, Review, fetchChefReviews } from '@/lib/reviews';
import { useSettings } from '@/lib/settings';

export default function ChefScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, l, colors, language, isRTL } = useSettings();
  const { getChef, dishesByChef, ratings, refresh, isNear } = useCatalog();
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
        <EmptyState icon="alert-circle-outline" title={t('error')} />
      </Screen>
    );
  const dishes = dishesByChef(chef.id);
  const rating = ratings[chef.id];
  const locale = language === 'ar' ? 'ar-EG' : language;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={[styles.hero, { backgroundColor: colors.surface }]}>
          <SafeAreaView edges={['top']} style={{ alignSelf: 'stretch' }}>
            <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10}>
              <Icon name={isRTL ? 'chevron-forward' : 'chevron-back'} size={24} />
            </Pressable>
          </SafeAreaView>
          <ChefAvatar chef={chef} size={120} />
          <Txt variant="title" center style={{ marginTop: 8 }}>
            {l(chef.name)}
          </Txt>
          <Txt muted center>
            {l(chef.specialty)} · {l(chef.area)}
          </Txt>
          <View style={{ marginTop: 8 }}>
            <ChefTags chefId={chef.id} center />
          </View>
          <View style={styles.stats}>
            <View style={[styles.stat, { backgroundColor: colors.surfaceAlt }]}>
              <Icon name={rating ? 'star' : 'sparkles'} size={16} color="#FFB300" />
              <Txt style={{ fontWeight: '600' }}>
                {rating
                  ? `${rating.overall.toFixed(1)} · ${t('reviewsCount', { n: rating.review_count })}`
                  : t('newChef')}
              </Txt>
            </View>
            <View style={[styles.stat, { backgroundColor: colors.surfaceAlt }]}>
              <Icon name="restaurant-outline" size={16} color={colors.textMuted} />
              <Txt style={{ fontWeight: '600' }}>
                {dishes.length} {t('dishes')}
              </Txt>
            </View>
          </View>
        </View>

        <View style={{ padding: 20, gap: 14 }}>
          {!isNear(chef.id) && (
            <View style={[styles.farNotice, { backgroundColor: colors.surfaceAlt }]}>
              <Icon name="location-outline" size={20} color={colors.danger} />
              <Txt variant="caption" style={{ flex: 1 }}>
                {t('outOfRange', { km: DELIVERY_RADIUS_KM })}
              </Txt>
            </View>
          )}
          {!!l(chef.bio) && (
            <Txt muted style={{ fontSize: 16, lineHeight: 24 }}>
              {l(chef.bio)}
            </Txt>
          )}
          <Txt variant="heading" style={styles.sectionTitle}>
            {t('menu')}
          </Txt>
          <View style={styles.grid}>
            {dishes.map((d) => (
              <View key={d.id} style={{ width: '48.5%' }}>
                <DishCard dish={d} wide />
              </View>
            ))}
          </View>

          <Txt variant="heading" style={styles.sectionTitle}>
            {t('reviews')}
          </Txt>

          {rating ? (
            <Card style={{ gap: 10 }}>
              {RATING_PARTS.map((part) => {
                const value = rating[part.key];
                return (
                  <View key={part.key} style={styles.ratingRow}>
                    <Icon name={part.icon} size={18} color={colors.textMuted} />
                    <Txt style={{ flex: 1, fontWeight: '500' }}>{t(part.label)}</Txt>
                    <View style={[styles.bar, { backgroundColor: colors.surfaceAlt }]}>
                      <View
                        style={[styles.barFill, { width: `${(value / 5) * 100}%`, backgroundColor: colors.primary }]}
                      />
                    </View>
                    <Txt style={styles.score}>{value.toFixed(1)}</Txt>
                  </View>
                );
              })}
            </Card>
          ) : (
            <Txt muted>{t('noReviews')}</Txt>
          )}

          {reviews.map((r) => (
            <Card key={r.id} style={{ gap: 6 }}>
              <View style={styles.reviewHead}>
                <View style={[styles.reviewer, { backgroundColor: colors.surfaceAlt }]}>
                  <Icon name="person" size={16} color={colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontWeight: '700' }}>{r.reviewer_name || t('customer')}</Txt>
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
            </Card>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  farNotice: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14 },
  hero: {
    alignItems: 'center',
    gap: 6,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  back: {
    alignSelf: 'flex-start',
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  stats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 10 },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  sectionTitle: { marginTop: 8 },
  reviewer: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bar: { width: 90, height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  score: { width: 32, textAlign: 'right', fontWeight: '700', fontVariant: ['tabular-nums'] },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewParts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 },
});
