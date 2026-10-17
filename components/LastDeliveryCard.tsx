import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { showAlert } from '@/lib/alert';
import { useCatalog } from '@/lib/catalog';
import { setLastDelivery } from '@/lib/chef';
import { EARLIEST_LAST_DELIVERY, LATEST_LAST_DELIVERY, STEP_MINUTES, formatTime } from '@/lib/schedule';
import { useSettings } from '@/lib/settings';
import { Button, Card, Icon, IconBadge, Txt } from './ui';

/** My kitchen: the chef picks the last time they deliver (1 PM - 11 PM). */
export function LastDeliveryCard({ chefId }: { chefId: string }) {
  const { t, colors, language } = useSettings();
  const { lastDelivery, refresh } = useCatalog();
  const saved = lastDelivery(chefId);
  // The time being picked; null shows the saved one.
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const value = picked ?? saved;

  const step = (delta: number) =>
    setPicked(Math.min(LATEST_LAST_DELIVERY, Math.max(EARLIEST_LAST_DELIVERY, value + delta)));

  const save = async () => {
    setBusy(true);
    try {
      await setLastDelivery(value);
      await refresh();
      setPicked(null);
      showAlert(t('lastDeliverySaved'), formatTime(value, language));
    } catch (e: any) {
      showAlert(t('error'), e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ gap: 12 }}>
      <View style={styles.row}>
        <IconBadge name="time-outline" tone="blue" size={32} />
        <Txt variant="label">{t('lastDeliveryTitle')}</Txt>
      </View>
      <Txt variant="caption" muted>
        {t('lastDeliveryBody')}
      </Txt>
      <View style={[styles.timeRow, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <Pressable
          onPress={() => step(-STEP_MINUTES)}
          disabled={value <= EARLIEST_LAST_DELIVERY}
          hitSlop={8}
          accessibilityLabel="-15">
          <Icon
            name="remove-circle-outline"
            size={32}
            color={value <= EARLIEST_LAST_DELIVERY ? colors.textMuted : colors.primary}
          />
        </Pressable>
        <Txt variant="title" center style={{ flex: 1, fontVariant: ['tabular-nums'] }}>
          {formatTime(value, language)}
        </Txt>
        <Pressable
          onPress={() => step(STEP_MINUTES)}
          disabled={value >= LATEST_LAST_DELIVERY}
          hitSlop={8}
          accessibilityLabel="+15">
          <Icon
            name="add-circle-outline"
            size={32}
            color={value >= LATEST_LAST_DELIVERY ? colors.textMuted : colors.primary}
          />
        </Pressable>
      </View>
      {value !== saved && <Button title={t('saveLastDelivery')} icon="checkmark" onPress={save} loading={busy} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
});
