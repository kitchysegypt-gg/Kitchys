import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Button, Card, EmptyState, Icon, Screen, ScreenHeader, Txt } from '@/components/ui';
import { AdminProblem, PendingDish, problemPhotoUrl, resolveProblem, reviewDish, useAdminDashboard } from '@/lib/admin';
import { showAlert, showConfirm } from '@/lib/alert';
import { FONT } from '@/lib/fonts';
import { useSettings } from '@/lib/settings';

/** More > Admin (kitchysegypt@gmail.com only): dishes to approve and order problems to sort out. */
export default function AdminScreen() {
  const { t, colors } = useSettings();
  const { data, loading, error, reload } = useAdminDashboard();

  if (error && !data)
    return (
      <Screen>
        <ScreenHeader title={t('adminTitle')} />
        <EmptyState icon="lock-closed-outline" title={t('adminOnly')} />
      </Screen>
    );

  const openProblems = (data?.problems ?? []).filter((p) => p.status === 'open');
  const pastProblems = (data?.problems ?? []).filter((p) => p.status !== 'open');

  return (
    <Screen>
      <ScreenHeader title={t('adminTitle')} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.primary} />}
        keyboardShouldPersistTaps="handled">
        {data && (
          <View style={styles.stats}>
            {(
              [
                ['adminOrdersToday', data.today.orders],
                ['adminOpenNow', data.today.open],
                ['adminDelivered', data.today.delivered],
                ['adminCancelled', data.today.cancelled],
              ] as const
            ).map(([label, n]) => (
              <Card key={label} style={styles.stat}>
                <Txt variant="heading">{n}</Txt>
                <Txt variant="caption" muted numberOfLines={2}>
                  {t(label)}
                </Txt>
              </Card>
            ))}
          </View>
        )}

        <Txt variant="label" muted style={styles.section}>
          {t('adminDishesTitle', { n: data?.pending_dishes.length ?? 0 })}
        </Txt>
        {data && data.pending_dishes.length === 0 && <Txt muted>{t('adminNoDishes')}</Txt>}
        {data?.pending_dishes.map((d) => <PendingDishCard key={d.id} dish={d} onDone={reload} />)}

        <Txt variant="label" muted style={styles.section}>
          {t('adminProblemsTitle', { n: openProblems.length })}
        </Txt>
        {data && openProblems.length === 0 && <Txt muted>{t('adminNoProblems')}</Txt>}
        {openProblems.map((p) => (
          <ProblemCard key={p.id} problem={p} onDone={reload} />
        ))}
        {pastProblems.length > 0 && (
          <>
            <Txt variant="label" muted style={styles.section}>
              {t('adminRecentlyHandled')}
            </Txt>
            {pastProblems.map((p) => (
              <Card key={p.id} style={{ gap: 2 }}>
                <Txt style={{ fontWeight: '700' }}>
                  {t('orderNumber', { n: p.order })} · {t(`problem_${p.kind}`)}
                </Txt>
                <Txt variant="caption" muted>
                  {p.status === 'refunded' ? t('adminRefunded', { amount: p.refund }) : t('adminClosed')}
                </Txt>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function PendingDishCard({ dish, onDone }: { dish: PendingDish; onDone: () => void }) {
  const { t, colors, formatPrice, isRTL } = useSettings();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const photos = (dish.photo_urls?.length ? dish.photo_urls : [dish.photo_url]).filter((u): u is string => !!u);

  const decide = async (approve: boolean) => {
    setBusy(approve ? 'approve' : 'reject');
    try {
      await reviewDish(dish.id, approve, approve ? undefined : note.trim() || undefined);
      onDone();
    } catch (e: any) {
      showAlert(t('error'), e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card style={{ gap: 10 }}>
      {photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {photos.map((uri) => (
            <Image key={uri} source={{ uri }} style={styles.photo} contentFit="cover" />
          ))}
        </ScrollView>
      )}
      <View>
        <Txt style={{ fontWeight: '700', fontSize: 16 }}>{dish.name}</Txt>
        <Txt variant="caption" muted>
          {dish.kitchen}
          {dish.area ? ` · ${dish.area}` : ''} · {formatPrice(dish.price)}
        </Txt>
      </View>
      {!!dish.description && <Txt>{dish.description}</Txt>}
      {!!dish.ingredients && (
        <Txt variant="caption" muted>
          {t('ingredients')}: {dish.ingredients}
        </Txt>
      )}
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder={t('adminRejectNote')}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text, textAlign: isRTL ? 'right' : 'left' }]}
      />
      <View style={styles.actions}>
        <Button small title={t('adminApprove')} icon="checkmark" onPress={() => decide(true)} loading={busy === 'approve'} style={{ flex: 1 }} />
        <Button
          small
          variant="secondary"
          title={t('adminReject')}
          icon="close"
          onPress={() => decide(false)}
          loading={busy === 'reject'}
          style={{ flex: 1 }}
        />
      </View>
    </Card>
  );
}

function ProblemCard({ problem, onDone }: { problem: AdminProblem; onDone: () => void }) {
  const { t, colors, formatPrice, isRTL } = useSettings();
  const [photo, setPhoto] = useState<string | null>(null);
  const [amount, setAmount] = useState(String(Math.round(problem.total)));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (problem.photo_path) problemPhotoUrl(problem.photo_path).then(setPhoto);
  }, [problem.photo_path]);

  const refund = Math.max(0, Math.round(Number(amount.replace(/[^0-9.]/g, '')) || 0));
  const finish = (value: number) =>
    showConfirm(
      value > 0 ? t('adminRefundTitle') : t('adminCloseTitle'),
      value > 0 ? t('adminRefundBody', { amount: formatPrice(value) }) : t('adminCloseBody'),
      {
        label: value > 0 ? t('adminRefund') : t('adminCloseNoRefund'),
        cancelLabel: t('cancel'),
        onConfirm: async () => {
          setBusy(true);
          try {
            await resolveProblem(problem.id, value, note.trim() || undefined);
            onDone();
          } catch (e: any) {
            showAlert(t('error'), e?.message ?? String(e));
          } finally {
            setBusy(false);
          }
        },
      }
    );

  return (
    <Card style={{ gap: 10 }}>
      <View style={styles.problemHead}>
        <View style={{ flex: 1 }}>
          <Txt style={{ fontWeight: '700' }}>
            {t(`problem_${problem.kind}`)} · {t('orderNumber', { n: problem.order })}
          </Txt>
          <Txt variant="caption" muted>
            {[problem.kitchen, problem.rider ? `${t('rider')}: ${problem.rider}` : null, formatPrice(problem.total)]
              .filter(Boolean)
              .join(' · ')}
          </Txt>
        </View>
        {problem.customer_phone && (
          <Pressable onPress={() => Linking.openURL(`tel:${problem.customer_phone}`)} hitSlop={8} accessibilityLabel={t('adminCallCustomer')}>
            <Icon name="call" size={26} color={colors.success} />
          </Pressable>
        )}
      </View>
      <Txt variant="caption" muted>
        {problem.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
      </Txt>
      {!!problem.details && <Txt>{problem.details}</Txt>}
      {photo && <Image source={{ uri: photo }} style={styles.problemPhoto} contentFit="cover" />}
      <View style={styles.actions}>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="number-pad"
          accessibilityLabel={t('adminRefundAmount')}
          style={[styles.input, styles.amount, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
        />
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={t('adminNoteToCustomer')}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { flex: 1, backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text, textAlign: isRTL ? 'right' : 'left' }]}
        />
      </View>
      <View style={styles.actions}>
        <Button small title={t('adminRefundCredit')} icon="wallet-outline" onPress={() => finish(refund)} loading={busy} disabled={refund <= 0} style={{ flex: 1 }} />
        <Button small variant="secondary" title={t('adminCloseNoRefund')} onPress={() => finish(0)} disabled={busy} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, padding: 10, gap: 2 },
  section: { marginTop: 8, paddingHorizontal: 4 },
  photo: { width: 140, height: 105, borderRadius: 12 },
  problemPhoto: { width: '100%', height: 200, borderRadius: 12 },
  problemHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actions: { flexDirection: 'row', gap: 8 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontFamily: FONT.regular },
  amount: { width: 90, textAlign: 'center' },
});
