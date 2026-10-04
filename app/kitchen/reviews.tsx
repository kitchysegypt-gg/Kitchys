import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Stars } from '@/components/media';
import { Button, Card, EmptyState, ScreenHeader, Txt } from '@/components/ui';
import { showAlert } from '@/lib/alert';
import type { TranslationKey } from '@/lib/i18n';
import { KitchenReview, leaveKitchen, useKitchen } from '@/lib/kitchen';
import { useSettings } from '@/lib/settings';

const PARTS: { key: 'food' | 'delivery' | 'packaging' | 'value'; label: TranslationKey }[] = [
  { key: 'food', label: 'ratingFood' },
  { key: 'delivery', label: 'ratingDelivery' },
  { key: 'packaging', label: 'ratingPackaging' },
  { key: 'value', label: 'ratingValue' },
];

const overallOf = (r: Pick<KitchenReview, 'food' | 'delivery' | 'packaging' | 'value'>) =>
  (r.food + r.delivery + r.packaging + r.value) / 4;

/** Kitchen > Reviews: the average per category and every review, with a reply. */
export default function KitchenReviewsScreen() {
  const { t, colors } = useSettings();
  const { reviews, refreshReviews } = useKitchen();
  const [refreshing, setRefreshing] = useState(false);

  const count = reviews.length;
  const avg = (key: (typeof PARTS)[number]['key']) => (count ? reviews.reduce((s, r) => s + r[key], 0) / count : 0);
  const overall = count ? reviews.reduce((s, r) => s + overallOf(r), 0) / count : 0;

  const pull = async () => {
    setRefreshing(true);
    await refreshReviews();
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView edges={['top']}>
        <ScreenHeader title={t('kitchenReviews')} onBack={leaveKitchen} />
      </SafeAreaView>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 12, paddingBottom: 40, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pull} tintColor={colors.primary} />}>
        {count === 0 ? (
          <EmptyState icon="star-outline" title={t('noReviewsYet')} body={t('noReviewsYetBody')} />
        ) : (
          <>
            <Card style={{ gap: 12 }}>
              <View style={styles.summary}>
                <Txt style={{ fontSize: 40, fontWeight: '800' }}>{overall.toFixed(1)}</Txt>
                <View style={{ gap: 4 }}>
                  <Stars value={Math.round(overall)} size={18} />
                  <Txt variant="caption" muted>
                    {t('reviewsCount', { n: count })}
                  </Txt>
                </View>
              </View>
              {PARTS.map((p) => (
                <View key={p.key} style={styles.partRow}>
                  <Txt variant="caption" style={{ width: 92 }}>
                    {t(p.label)}
                  </Txt>
                  <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
                    <View style={[styles.fill, { width: `${(avg(p.key) / 5) * 100}%`, backgroundColor: colors.primary }]} />
                  </View>
                  <Txt variant="caption" style={{ width: 30, textAlign: 'right', fontWeight: '700' }}>
                    {avg(p.key).toFixed(1)}
                  </Txt>
                </View>
              ))}
            </Card>
            {reviews.map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function ReviewCard({ review }: { review: KitchenReview }) {
  const { t, colors, language, isRTL } = useSettings();
  const { replyToReview } = useKitchen();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(review.chef_reply ?? '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await replyToReview(review.id, text);
      setEditing(false);
    } catch (e: any) {
      showAlert(t('error'), e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const date = new Date(review.created_at).toLocaleDateString(language === 'ar' ? 'ar-EG' : language, {
    day: 'numeric',
    month: 'short',
  });

  return (
    <Card style={{ gap: 8 }}>
      <View style={styles.reviewHead}>
        <Txt style={{ fontWeight: '700', flex: 1 }}>{review.reviewer_name || t('aCustomer')}</Txt>
        <Txt variant="caption" muted>
          {date}
        </Txt>
      </View>
      <Stars value={Math.round(overallOf(review))} size={15} />
      {review.comment ? <Txt>{review.comment}</Txt> : null}

      {editing ? (
        <View style={{ gap: 8 }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('replyPlaceholder')}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
            style={[
              styles.input,
              {
                backgroundColor: colors.surfaceAlt,
                borderColor: colors.border,
                color: colors.text,
                textAlign: isRTL ? 'right' : 'left',
              },
            ]}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title={t('cancel')} variant="ghost" small onPress={() => setEditing(false)} />
            <Button title={t('sendReply')} icon="send" small onPress={save} loading={busy} style={{ flex: 1 }} />
          </View>
        </View>
      ) : review.chef_reply ? (
        <View style={[styles.reply, { backgroundColor: colors.surfaceAlt, borderColor: colors.primary }]}>
          <Txt variant="caption" style={{ fontWeight: '700', color: colors.primary }}>
            {t('yourReply')}
          </Txt>
          <Txt variant="caption">{review.chef_reply}</Txt>
          <Button title={t('editReply')} variant="ghost" small onPress={() => setEditing(true)} />
        </View>
      ) : (
        <Button title={t('reply')} icon="chatbubble-outline" variant="secondary" small onPress={() => setEditing(true)} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  partRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reply: { gap: 4, padding: 10, borderRadius: 12, borderStartWidth: 3 },
  input: { minHeight: 80, borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 15, textAlignVertical: 'top' },
});
