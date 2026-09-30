import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Emoji3D } from '@/components/Emoji3D';
import { ChefAvatar, Stars } from '@/components/media';
import { Button3D, Card3D, EmptyState, Screen, Txt } from '@/components/ui';
import { showAlert } from '@/lib/alert';
import { useAuth } from '@/lib/auth';
import { useCatalog } from '@/lib/catalog';
import { useOrders } from '@/lib/orders';
import { RATING_PARTS, fetchMyReviews, submitReview } from '@/lib/reviews';
import { useSettings } from '@/lib/settings';

type Scores = { food: number; delivery: number; packaging: number; value: number; comment: string };
const EMPTY: Scores = { food: 0, delivery: 0, packaging: 0, value: 0, comment: '' };

export default function ReviewScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { t, l, colors, isRTL } = useSettings();
  const { session } = useAuth();
  const { orders } = useOrders();
  const { getDish, getChef, refresh } = useCatalog();
  const [done, setDone] = useState<string[]>([]);
  const [scores, setScores] = useState<Record<string, Scores>>({});
  const [busy, setBusy] = useState(false);

  const order = orders.find((o) => o.id === orderId);
  const chefIds = useMemo(
    () => [...new Set((order?.items ?? []).map((i) => getDish(i.dishId)?.chefId).filter(Boolean) as string[])],
    [order, getDish]
  );

  useEffect(() => {
    if (!session) return;
    fetchMyReviews(session.user.id)
      .then((mine) => setDone(mine.filter((r) => r.order_id === orderId).map((r) => r.chef_id)))
      .catch(() => {});
  }, [session, orderId]);

  if (!order)
    return (
      <Screen>
        <EmptyState emoji="warning" title={t('error')} />
      </Screen>
    );

  const pending = chefIds.filter((id) => !done.includes(id));
  const update = (chefId: string, patch: Partial<Scores>) =>
    setScores((prev) => ({ ...prev, [chefId]: { ...EMPTY, ...prev[chefId], ...patch } }));
  const complete = (s?: Scores) => !!s && s.food > 0 && s.delivery > 0 && s.packaging > 0 && s.value > 0;
  const ready = pending.filter((id) => complete(scores[id]));

  const send = async () => {
    setBusy(true);
    try {
      for (const chefId of ready) {
        const s = scores[chefId];
        await submitReview({ chef_id: chefId, order_id: order.id, ...s, comment: s.comment.trim() });
      }
      await refresh();
      showAlert(t('reviewThanks'));
      router.back();
    } catch (e: any) {
      showAlert(t('error'), e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={[styles.close, { backgroundColor: colors.surface }]}>
          <Emoji3D name="cross_mark" size={20} />
        </Pressable>
        <Txt variant="heading">{t('rateTitle')}</Txt>
      </SafeAreaView>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled">
          {chefIds.map((chefId) => {
            const chef = getChef(chefId);
            if (!chef) return null;
            const s = { ...EMPTY, ...scores[chefId] };
            const reviewed = done.includes(chefId);
            return (
              <Card3D key={chefId} style={{ gap: 12 }}>
                <View style={styles.chefRow}>
                  <ChefAvatar chef={chef} size={48} />
                  <View style={{ flex: 1 }}>
                    <Txt style={{ fontWeight: '900' }}>{l(chef.name)}</Txt>
                    <Txt variant="caption" muted>
                      {reviewed ? `✓ ${t('rated')}` : t('rateBody', { chef: l(chef.name) })}
                    </Txt>
                  </View>
                </View>
                {!reviewed && (
                  <>
                    {RATING_PARTS.map((part) => (
                      <View key={part.key} style={styles.partRow}>
                        <Emoji3D name={part.emoji} size={22} />
                        <Txt style={{ flex: 1, fontWeight: '700' }}>{t(part.label)}</Txt>
                        <Stars value={s[part.key]} size={26} onChange={(v) => update(chefId, { [part.key]: v })} />
                      </View>
                    ))}
                    <TextInput
                      value={s.comment}
                      onChangeText={(comment) => update(chefId, { comment })}
                      placeholder={t('commentPlaceholder')}
                      placeholderTextColor={colors.textMuted}
                      maxLength={500}
                      multiline
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
                  </>
                )}
              </Card3D>
            );
          })}
          {pending.length > 0 && (
            <Button3D
              title={t('submitReview')}
              emoji="star"
              onPress={send}
              loading={busy}
              disabled={ready.length === 0}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 8 },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  chefRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  partRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { borderRadius: 14, borderWidth: 1, padding: 12, fontSize: 15, minHeight: 70 },
});
