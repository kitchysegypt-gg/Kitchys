import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { showAlert, showConfirm } from '@/lib/alert';
import { KitchenDeal } from '@/lib/kitchen';
import { formatTime } from '@/lib/schedule';
import { useSettings } from '@/lib/settings';
import { Button, Icon, IconBadge, Txt } from './ui';

/**
 * Kitchen > Menu, under each dish: sell extra portions cheaper today ("Today's deal"),
 * or see and end the deal that's running.
 */
export function DealPanel({
  dishId,
  price,
  deal,
  onStart,
  onEnd,
}: {
  dishId: string;
  price: number;
  deal?: KitchenDeal;
  onStart: (dishId: string, price: number, quantity: number) => Promise<void>;
  onEnd: (dealId: string) => Promise<void>;
}) {
  const { t, colors, formatPrice, language, isRTL } = useSettings();
  const [open, setOpen] = useState(false);
  const [portions, setPortions] = useState(3);
  // Suggest about a quarter off, rounded to 5 EGP.
  const [dealPrice, setDealPrice] = useState(String(Math.max(5, Math.round((price * 0.75) / 5) * 5)));
  const [busy, setBusy] = useState(false);

  if (deal) {
    const ends = new Date(deal.expires_at);
    const endMinutes = ends.getHours() * 60 + ends.getMinutes();
    return (
      <View style={[styles.box, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}40` }]}>
        <IconBadge name="flame-outline" tone="orange" size={32} solid />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt style={{ fontWeight: '800' }}>
            {t('dealRunning', { price: formatPrice(deal.price), was: formatPrice(price) })}
          </Txt>
          <Txt variant="caption" muted>
            {t('dealProgress', { sold: deal.sold, total: deal.quantity, time: formatTime(endMinutes, language) })}
          </Txt>
        </View>
        <Button
          small
          variant="ghost"
          title={t('endDeal')}
          loading={busy}
          onPress={() =>
            showConfirm(t('endDealTitle'), t('endDealBody'), {
              label: t('endDeal'),
              cancelLabel: t('cancel'),
              onConfirm: async () => {
                setBusy(true);
                try {
                  await onEnd(deal.id);
                } catch (e: any) {
                  showAlert(t('error'), e?.message ?? String(e));
                } finally {
                  setBusy(false);
                }
              },
            })
          }
        />
      </View>
    );
  }

  if (!open) {
    return <Button small variant="secondary" icon="flame-outline" title={t('sellExtraToday')} onPress={() => setOpen(true)} />;
  }

  const start = async () => {
    const value = Math.round(Number(dealPrice.replace(',', '.')));
    if (!(value > 0) || value >= price) return showAlert(t('sellExtraToday'), t('dealPriceTooHigh', { price: formatPrice(price) }));
    setBusy(true);
    try {
      await onStart(dishId, value, portions);
      setOpen(false);
      showAlert(t('dealStartedTitle'), t('dealStartedBody'));
    } catch (e: any) {
      showAlert(t('error'), e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.form, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
      <Txt variant="caption" muted>
        {t('sellExtraBody')}
      </Txt>
      <View style={styles.row}>
        <Txt style={{ flex: 1, fontWeight: '700' }}>{t('dealPortions')}</Txt>
        <Pressable onPress={() => setPortions((n) => Math.max(1, n - 1))} hitSlop={8} accessibilityLabel={t('fewer')}>
          <Icon name="remove-circle" size={30} color={colors.primary} />
        </Pressable>
        <Txt style={{ minWidth: 30, textAlign: 'center', fontWeight: '800', fontSize: 17 }}>{portions}</Txt>
        <Pressable onPress={() => setPortions((n) => Math.min(50, n + 1))} hitSlop={8} accessibilityLabel={t('more')}>
          <Icon name="add-circle" size={30} color={colors.primary} />
        </Pressable>
      </View>
      <View style={styles.row}>
        <Txt style={{ flex: 1, fontWeight: '700' }}>{t('dealPrice')}</Txt>
        <TextInput
          value={dealPrice}
          onChangeText={setDealPrice}
          keyboardType="number-pad"
          accessibilityLabel={t('dealPrice')}
          style={[
            styles.input,
            { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, textAlign: isRTL ? 'right' : 'left' },
          ]}
        />
        <Txt muted>{t('egp')}</Txt>
      </View>
      <Txt variant="caption" muted>
        {t('dealUsualPrice', { price: formatPrice(price) })}
      </Txt>
      <View style={styles.row}>
        <Button small variant="ghost" title={t('cancel')} onPress={() => setOpen(false)} />
        <Button small icon="flame" title={t('startDeal')} onPress={start} loading={busy} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, borderWidth: 1 },
  form: { gap: 10, padding: 12, borderRadius: 14, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { width: 90, borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, fontSize: 16, fontWeight: '700' },
});
