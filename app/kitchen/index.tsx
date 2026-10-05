import { Href, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Bar, BarChart } from '@/components/BarChart';
import { Stars } from '@/components/media';
import { Card, Chip, Icon, IconBadge, IconName, ScreenHeader, Txt } from '@/components/ui';
import type { Language } from '@/lib/i18n';
import { COMMISSION_RATE, KitchenStats, leaveKitchen, splitSales, useKitchen } from '@/lib/kitchen';
import { formatTime } from '@/lib/schedule';
import type { IconTone } from '@/lib/theme';
import { useSettings } from '@/lib/settings';

const PERIODS = [7, 30, 90] as const;

const locale = (language: Language) => (language === 'ar' ? 'ar-EG' : language);

/** Change against the period before, e.g. "+20%"; null when there's nothing to compare. */
function change(now: number, before: number) {
  if (!before) return null;
  const pct = Math.round(((now - before) / before) * 100);
  return pct;
}

/** Kitchen > Dashboard: today at a glance, then orders, sales, dishes and ratings over time. */
export default function KitchenDashboard() {
  const { t, colors, formatPrice, language } = useSettings();
  const { kitchen, openOrders, paused, loadStats } = useKitchen();
  const [days, setDays] = useState<(typeof PERIODS)[number]>(7);
  const [stats, setStats] = useState<KitchenStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    () =>
      loadStats(days)
        .then((s) => {
          setStats(s);
          setError(null);
        })
        .catch((e) => setError(e?.message ?? String(e))),
    [days, loadStats]
  );

  // Fresh numbers whenever the dashboard is opened or the period changes.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const pull = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const waiting = openOrders.filter((o) => o.status === 'placed' && !o.accepted_at).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView edges={['top']}>
        <ScreenHeader title={t('kitchenDashboard')} onBack={leaveKitchen} />
      </SafeAreaView>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 14, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pull} tintColor={colors.primary} />}>
        <View style={styles.hello}>
          <Txt variant="title" style={{ flex: 1 }} numberOfLines={1}>
            {t('helloChef', { name: kitchen?.name.split(' ')[0] ?? '' })}
          </Txt>
          <Pressable
            onPress={() => router.navigate('/kitchen/settings' as Href)}
            style={[styles.statePill, { backgroundColor: paused ? `${colors.danger}18` : colors.successBg }]}
            accessibilityRole="button">
            <View style={[styles.dot, { backgroundColor: paused ? colors.danger : colors.success }]} />
            <Txt style={{ fontSize: 12, fontWeight: '700', color: paused ? colors.danger : colors.success }}>
              {paused ? t('kitchenPausedShort') : t('kitchenOpenShort')}
            </Txt>
          </Pressable>
        </View>

        {waiting > 0 && (
          <Pressable onPress={() => router.navigate('/kitchen/orders' as Href)} accessibilityRole="button">
            <View style={[styles.alert, { backgroundColor: colors.primary }]}>
              <Icon name="notifications" size={22} color={colors.onPrimary} />
              <Txt style={{ flex: 1, color: colors.onPrimary, fontWeight: '800' }}>
                {t('newOrdersWaiting', { n: waiting })}
              </Txt>
              <Icon name="chevron-forward" size={20} color={colors.onPrimary} />
            </View>
          </Pressable>
        )}

        {!stats ? (
          error ? (
            <Txt muted>{error}</Txt>
          ) : (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
          )
        ) : (
          <>
            <Card style={{ gap: 10 }}>
              <SectionTitle icon="sunny-outline" tone="amber" title={t('today')} />
              <View style={styles.todayRow}>
                <TodayFigure icon="receipt-outline" tone="blue" value={String(stats.today.orders)} label={t('ordersWord')} />
                <TodayFigure icon="cash-outline" tone="green" value={formatPrice(Number(stats.today.sales))} label={t('salesWord')} />
                <TodayFigure icon="flame-outline" tone="orange" value={String(stats.today.open)} label={t('inProgress')} />
              </View>
            </Card>

            <View style={styles.periods}>
              {PERIODS.map((p) => (
                <Chip key={p} label={t('lastDays', { n: p })} active={days === p} onPress={() => setDays(p)} />
              ))}
            </View>

            <View style={styles.tiles}>
              <Tile
                icon="receipt-outline"
                tone="blue"
                label={t('ordersWord')}
                value={String(stats.orders)}
                delta={change(stats.orders, stats.prev_orders)}
              />
              <Tile
                icon="cash-outline"
                tone="green"
                label={t('salesWord')}
                value={formatPrice(Number(stats.sales))}
                delta={change(Number(stats.sales), Number(stats.prev_sales))}
              />
              <Tile icon="basket-outline" tone="amber" label={t('averageOrder')} value={formatPrice(Number(stats.average_order))} />
              <Tile
                icon="people-outline"
                tone="purple"
                label={t('customersWord')}
                value={String(stats.customers)}
                note={stats.repeat_customers ? t('repeatCustomers', { n: stats.repeat_customers }) : undefined}
              />
            </View>

            <EarningsCard sales={Number(stats.sales)} />

            <Card style={{ gap: 10 }}>
              <SectionTitle icon="trending-up-outline" tone="green" title={t('salesOverTime')} />
              <SalesChart stats={stats} />
            </Card>

            <Card style={{ gap: 10 }}>
              <SectionTitle icon="calendar-outline" tone="blue" title={t('busiestDays')} />
              <WeekdayChart stats={stats} />
              {stats.by_hour.length > 0 && (
                <Txt variant="caption" muted>
                  {t('busiestHour', {
                    time: formatTime(
                      [...stats.by_hour].sort((a, b) => b.orders - a.orders)[0].hour * 60,
                      language
                    ),
                  })}
                </Txt>
              )}
            </Card>

            <Card style={{ gap: 10 }}>
              <SectionTitle icon="trophy-outline" tone="amber" title={t('topDishes')} />
              {stats.top_dishes.length === 0 ? (
                <Txt variant="caption" muted>
                  {t('noOrdersInPeriod')}
                </Txt>
              ) : (
                stats.top_dishes.map((d, i) => (
                  <View key={d.dish_id} style={{ gap: 4 }}>
                    <View style={styles.dishRow}>
                      <Txt style={{ fontWeight: '800', width: 20, color: colors.primary }}>{i + 1}</Txt>
                      <Txt style={{ flex: 1, fontWeight: '600' }} numberOfLines={1}>
                        {d.name}
                      </Txt>
                      <Txt variant="caption" muted>
                        {t('portionsCount', { n: d.qty })} · {formatPrice(Number(d.sales))}
                      </Txt>
                    </View>
                    <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
                      <View
                        style={{
                          width: `${(d.qty / stats.top_dishes[0].qty) * 100}%`,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: colors.primary,
                        }}
                      />
                    </View>
                  </View>
                ))
              )}
            </Card>

            <Pressable onPress={() => router.navigate('/kitchen/reviews' as Href)} accessibilityRole="button">
              <Card style={{ gap: 8 }}>
                <View style={styles.dishRow}>
                  <View style={{ flex: 1 }}>
                    <SectionTitle icon="star-outline" tone="pink" title={t('kitchenReviews')} />
                  </View>
                  <Icon name="chevron-forward" size={18} color={colors.textMuted} />
                </View>
                {stats.rating.count ? (
                  <>
                    <View style={styles.dishRow}>
                      <Txt style={{ fontSize: 30, fontWeight: '800' }}>{Number(stats.rating.overall).toFixed(1)}</Txt>
                      <View style={{ gap: 2 }}>
                        <Stars value={Math.round(Number(stats.rating.overall))} size={16} />
                        <Txt variant="caption" muted>
                          {t('reviewsCount', { n: stats.rating.count })}
                        </Txt>
                      </View>
                    </View>
                    {stats.rating.unanswered > 0 && (
                      <Txt variant="caption" style={{ color: colors.primary, fontWeight: '700' }}>
                        {t('unansweredReviews', { n: stats.rating.unanswered })}
                      </Txt>
                    )}
                  </>
                ) : (
                  <Txt variant="caption" muted>
                    {t('noReviewsYet')}
                  </Txt>
                )}
              </Card>
            </Pressable>

            {stats.cancelled > 0 && (
              <Txt variant="caption" muted center>
                {t('cancelledInPeriod', { n: stats.cancelled })}
              </Txt>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** A card heading with its coloured icon tile. */
/** Sales, minus Kitchy's commission, equals what the chef earns. */
function EarningsCard({ sales }: { sales: number }) {
  const { t, colors, formatPrice } = useSettings();
  const { commission, earnings } = splitSales(sales);
  const pct = Math.round(COMMISSION_RATE * 100);
  return (
    <Card style={{ gap: 8 }}>
      <SectionTitle icon="wallet-outline" tone="green" title={t('earningsTitle')} />
      <View style={styles.moneyRow}>
        <Txt muted>{t('salesWord')}</Txt>
        <Txt style={{ fontWeight: '700' }}>{formatPrice(sales)}</Txt>
      </View>
      <View style={styles.moneyRow}>
        <Txt muted>{t('commissionLine', { pct })}</Txt>
        <Txt style={{ fontWeight: '700' }}>−{formatPrice(commission)}</Txt>
      </View>
      <View style={[styles.moneyRow, styles.moneyTotal, { borderTopColor: colors.border }]}>
        <Txt style={{ fontWeight: '800' }}>{t('earningsTitle')}</Txt>
        <Txt style={{ fontWeight: '800', fontSize: 18, color: colors.success }}>{formatPrice(earnings)}</Txt>
      </View>
      <Txt variant="caption" muted>
        {t('earningsNote', { pct })}
      </Txt>
    </Card>
  );
}

function SectionTitle({ icon, tone, title }: { icon: IconName; tone: IconTone; title: string }) {
  return (
    <View style={styles.sectionTitle}>
      <IconBadge name={icon} tone={tone} size={32} />
      <Txt style={{ fontWeight: '800', fontSize: 16 }}>{title}</Txt>
    </View>
  );
}

function TodayFigure({ icon, tone, value, label }: { icon: IconName; tone: IconTone; value: string; label: string }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <IconBadge name={icon} tone={tone} size={30} />
      <Txt style={{ fontSize: 22, fontWeight: '800' }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Txt>
      <Txt variant="caption" muted>
        {label}
      </Txt>
    </View>
  );
}

function Tile({
  icon,
  tone,
  label,
  value,
  delta,
  note,
}: {
  icon: IconName;
  tone: IconTone;
  label: string;
  value: string;
  delta?: number | null;
  note?: string;
}) {
  const { t, colors } = useSettings();
  return (
    <Card style={styles.tile}>
      <IconBadge name={icon} tone={tone} size={38} />
      <Txt style={{ fontSize: 22, fontWeight: '800' }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Txt>
      <Txt variant="caption" muted>
        {label}
      </Txt>
      {delta != null ? (
        <View style={styles.delta}>
          <Icon
            name={delta >= 0 ? 'trending-up' : 'trending-down'}
            size={14}
            color={delta >= 0 ? colors.success : colors.danger}
          />
          <Txt variant="caption" style={{ fontWeight: '700', color: delta >= 0 ? colors.success : colors.danger }}>
            {delta >= 0 ? '+' : ''}
            {delta}% {t('vsBefore')}
          </Txt>
        </View>
      ) : note ? (
        <Txt variant="caption" style={{ fontWeight: '600' }}>
          {note}
        </Txt>
      ) : null}
    </Card>
  );
}

/** Sales per day (7 or 30 days) or per week (90 days). */
function SalesChart({ stats }: { stats: KitchenStats }) {
  const { t, formatPrice, language } = useSettings();
  const dayLabel = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(locale(language), opts);

  let bars: Bar[];
  if (stats.days > 31) {
    // Weeks, oldest first, each labelled with its first day.
    bars = [];
    for (let i = 0; i < stats.by_day.length; i += 7) {
      const week = stats.by_day.slice(i, i + 7);
      const sales = week.reduce((s, d) => s + Number(d.sales), 0);
      const orders = week.reduce((s, d) => s + d.orders, 0);
      const label = dayLabel(week[0].day, { day: 'numeric', month: 'short' });
      bars.push({ label, value: sales, detail: t('chartDetail', { when: t('weekOf', { day: label }), sales: formatPrice(sales), n: orders }) });
    }
  } else {
    bars = stats.by_day.map((d) => {
      const label = stats.days <= 7 ? dayLabel(d.day, { weekday: 'short' }) : dayLabel(d.day, { day: 'numeric' });
      const when = dayLabel(d.day, { weekday: 'short', day: 'numeric', month: 'short' });
      return { label, value: Number(d.sales), detail: t('chartDetail', { when, sales: formatPrice(Number(d.sales)), n: d.orders }) };
    });
  }
  return (
    <BarChart
      bars={bars}
      labelEvery={stats.days > 31 ? 2 : stats.days > 7 ? 5 : 1}
      summary={`${t('salesOverTime')}: ${formatPrice(Number(stats.sales))}`}
    />
  );
}

/** Orders per weekday over the chosen period. */
function WeekdayChart({ stats }: { stats: KitchenStats }) {
  const { t, language } = useSettings();
  // 2026-10-04 is a Sunday, so day n of that week has weekday n.
  const name = (wd: number, style: 'short' | 'long') =>
    new Date(2026, 9, 4 + wd, 12).toLocaleDateString(locale(language), { weekday: style });
  const bars = stats.by_weekday.map((w) => ({
    label: name(w.weekday, 'short'),
    value: w.orders,
    detail: t('weekdayDetail', { day: name(w.weekday, 'long'), n: w.orders }),
  }));
  return <BarChart bars={bars} height={100} summary={t('busiestDays')} />;
}

const styles = StyleSheet.create({
  moneyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  moneyTotal: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  hello: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16 },
  todayRow: { flexDirection: 'row', gap: 12 },
  periods: { flexDirection: 'row', gap: 8 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { flexBasis: '47%', flexGrow: 1, gap: 4 },
  delta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dishRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
});
