import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, IconBadge, Txt } from '@/components/ui';
import { RiderStats, useRider } from '@/lib/rider';
import { useSettings } from '@/lib/settings';

/**
 * Rider > Earnings: what the rider earned (EGP 30 a delivery plus every tip), the cash they
 * collected, and what they hand to Kitchy's, today and over the last 7 days.
 */
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
          <Tile
            icon="today-outline"
            tone="orange"
            label={t('riderToday')}
            value={formatPrice(Number(stats?.today_earnings ?? 0))}
            sub={t('riderDeliveriesN', { n: stats?.today_deliveries ?? 0 })}
          />
          <Tile
            icon="calendar-outline"
            tone="blue"
            label={t('riderLast7')}
            value={formatPrice(Number(stats?.earnings ?? 0))}
            sub={t('riderDeliveriesN', { n: stats?.deliveries ?? 0 })}
          />
        </View>

        <Card style={{ gap: 10 }}>
          <Txt variant="caption" muted>
            {t('riderLast7')}
          </Txt>
          <View style={styles.row}>
            <IconBadge name="cash-outline" tone="blue" size={30} />
            <Txt style={{ flex: 1, fontWeight: '600' }}>{t('riderCashCollected')}</Txt>
            <Txt style={{ fontWeight: '700' }}>{formatPrice(Number(stats?.cash ?? 0))}</Txt>
          </View>
          <View style={styles.row}>
            <IconBadge name="wallet-outline" tone="green" size={30} />
            <Txt style={{ flex: 1, fontWeight: '600' }}>{t('riderEarnings')}</Txt>
            <Txt style={{ fontWeight: '700', color: colors.success }}>{formatPrice(Number(stats?.earnings ?? 0))}</Txt>
          </View>
          {Number(stats?.tips ?? 0) > 0 && (
            <Txt variant="caption" muted style={{ marginTop: -6, marginStart: 40 }}>
              {t('riderTipIncluded', { amount: formatPrice(Number(stats?.tips ?? 0)) })}
            </Txt>
          )}
          <View style={[styles.row, styles.handOver, { borderColor: colors.border }]}>
            <IconBadge name="business-outline" tone="orange" size={30} />
            {/* Negative when credit-paid orders left less cash than the rider earned: Kitchy's owes them. */}
            <Txt style={{ flex: 1, fontWeight: '700' }}>
              {Number(stats?.hand_over ?? 0) < 0 ? t('riderKitchysOwes') : t('riderHandOver')}
            </Txt>
            <Txt style={{ fontWeight: '800', fontSize: 18 }}>{formatPrice(Math.abs(Number(stats?.hand_over ?? 0)))}</Txt>
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
                <Txt style={{ fontWeight: '700', minWidth: 90, textAlign: 'right', color: colors.success }}>
                  {formatPrice(Number(d.earnings ?? 0))}
                </Txt>
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
  handOver: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});
