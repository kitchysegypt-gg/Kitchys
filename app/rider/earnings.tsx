import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, IconBadge, Txt } from '@/components/ui';
import { RiderStats, useRider } from '@/lib/rider';
import { useSettings } from '@/lib/settings';

/** Rider > Earnings: deliveries and cash collected today and over the last 7 days. */
export default function RiderEarningsScreen() {
  const { t, colors, formatPrice, language } = useSettings();
  const { loadStats } = useRider();
  const [stats, setStats] = useState<RiderStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setStats(await loadStats(7));
  }, [loadStats]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const day = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(language === 'ar' ? 'ar-EG' : language, {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    });

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.primary}
          />
        }>
        <Txt variant="title">{t('riderTabEarnings')}</Txt>

        <View style={styles.tiles}>
          <Tile icon="today-outline" tone="orange" label={t('riderToday')} value={t('riderDeliveriesN', { n: stats?.today_deliveries ?? 0 })} sub={formatPrice(Number(stats?.today_cash ?? 0))} />
          <Tile icon="calendar-outline" tone="blue" label={t('riderLast7')} value={t('riderDeliveriesN', { n: stats?.deliveries ?? 0 })} sub={formatPrice(Number(stats?.cash ?? 0))} />
        </View>

        <Card style={{ gap: 6 }}>
          <View style={styles.row}>
            <IconBadge name="cash-outline" tone="green" size={30} />
            <Txt style={{ flex: 1, fontWeight: '700' }}>{t('riderCashCollected')}</Txt>
            <Txt style={{ fontWeight: '800', fontSize: 18 }}>{formatPrice(Number(stats?.cash ?? 0))}</Txt>
          </View>
          <Txt variant="caption" muted>
            {t('riderCashNote')}
          </Txt>
        </Card>

        {stats?.by_day.length ? (
          <Card style={{ gap: 4 }}>
            {[...stats.by_day].reverse().map((d) => (
              <View key={d.day} style={[styles.dayRow, { borderColor: colors.border }]}>
                <Txt style={{ flex: 1 }}>{day(d.day)}</Txt>
                <Txt muted>{t('riderDeliveriesN', { n: d.deliveries })}</Txt>
                <Txt style={{ fontWeight: '700', minWidth: 90, textAlign: 'right' }}>{formatPrice(Number(d.cash))}</Txt>
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Tile({
  icon,
  tone,
  label,
  value,
  sub,
}: {
  icon: 'today-outline' | 'calendar-outline';
  tone: 'orange' | 'blue';
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card style={{ flex: 1, gap: 6 }}>
      <IconBadge name={icon} tone={tone} size={32} />
      <Txt variant="caption" muted>
        {label}
      </Txt>
      <Txt style={{ fontWeight: '800', fontSize: 18 }}>{value}</Txt>
      <Txt muted>{sub}</Txt>
    </Card>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});
