import { router, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { TrackingMap } from '@/components/TrackingMap';
import { Button, Card, EmptyState, Icon, IconBadge, IconName, Screen, ScreenHeader, Txt } from '@/components/ui';
import { useCatalog } from '@/lib/catalog';
import { FONT } from '@/lib/fonts';
import type { TranslationKey } from '@/lib/i18n';
import { useOrderRiders } from '@/lib/orderRiders';
import { Order, useOrders } from '@/lib/orders';
import { formatSlot } from '@/lib/schedule';
import { useSettings } from '@/lib/settings';

const STEPS: { label: TranslationKey; icon: IconName; at: (o: Order) => string | null | undefined }[] = [
  { label: 'stepConfirmed', icon: 'receipt-outline', at: (o) => o.accepted_at },
  { label: 'stepPreparing', icon: 'flame-outline', at: (o) => o.ready_at },
  { label: 'stepOnTheWay', icon: 'delivery', at: (o) => o.picked_up_at },
  { label: 'stepDelivered', icon: 'home-outline', at: (o) => o.delivered_at },
];

/** How many steps are finished, and which one is happening now. */
function progress(order: Order): { done: number; active: number | null } {
  switch (order.status) {
    case 'placed':
      return order.accepted_at ? { done: 1, active: null } : { done: 0, active: 0 };
    case 'cooking':
    case 'ready':
      return { done: 1, active: 1 };
    case 'on_the_way':
      return { done: 2, active: 2 };
    case 'delivered':
      return { done: 4, active: null };
    default:
      return { done: 0, active: null };
  }
}

/**
 * Following one order: the steps, the rider on a map once they're about 5 minutes away
 * (before that only "on the way" and the minutes left), and the rider to call.
 */
export default function TrackOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, l, colors, formatPrice, language } = useSettings();
  const { orders } = useOrders();
  const { getDish, getChef } = useCatalog();
  const order = orders.find((o) => o.id === id);
  const active = !!order && ['cooking', 'ready', 'on_the_way'].includes(order.status) && !!order.rider_id;
  // Every 10 seconds while the food is on its way, so the map keeps up with the rider.
  const riders = useOrderRiders(active ? [order!.id] : [], order?.status === 'on_the_way' ? 10_000 : 30_000);
  const rider = order ? riders[order.id] : undefined;

  if (!order) {
    return (
      <Screen>
        <ScreenHeader title={t('trackTitle')} />
        <EmptyState icon="bag-handle-outline" title={t('noOrders')} body={t('noOrdersBody')} />
      </Screen>
    );
  }

  const { done, active: current } = progress(order);
  const chef = order.chef_id ? getChef(order.chef_id) : undefined;
  const live = !!rider?.live && rider.latitude != null && rider.longitude != null;
  const onTheWay = order.status === 'on_the_way';
  const eta = onTheWay ? rider?.eta_minutes ?? null : null;
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString(language === 'ar' ? 'ar-EG' : language, { hour: 'numeric', minute: '2-digit' });

  const headline: TranslationKey =
    order.status === 'placed'
      ? order.accepted_at
        ? 'trackAccepted'
        : 'trackPlaced'
      : order.status === 'cooking'
        ? 'trackCooking'
        : order.status === 'ready'
          ? order.rider_id
            ? 'trackReady'
            : 'trackWaitingRider'
          : order.status === 'on_the_way'
            ? live
              ? 'trackNearby'
              : 'trackOnTheWay'
            : order.status === 'delivered'
              ? 'trackDelivered'
              : 'trackCancelled';

  const showMap =
    order.delivery_lat != null && order.delivery_lng != null && order.status !== 'cancelled' && order.status !== 'delivered';

  return (
    <Screen>
      <ScreenHeader
        title={t('trackTitle')}
        right={
          <Pressable
            onPress={() => router.push('/chat')}
            hitSlop={8}
            style={[styles.help, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={t('helpTitle')}>
            <Icon name="headset-outline" size={20} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 12, paddingBottom: 40 }}>
        {order.status !== 'cancelled' && (
          <Card style={styles.steps}>
            {STEPS.map((step, i) => {
              const isDone = i < done;
              const isActive = i === current;
              const at = step.at(order);
              return (
                <View key={step.label} style={styles.step}>
                  {i > 0 && (
                    <View
                      style={[
                        styles.link,
                        { backgroundColor: isActive ? colors.primary : i <= done ? colors.success : colors.border },
                        i > done && !isActive && styles.linkPending,
                      ]}
                    />
                  )}
                  <View
                    style={[
                      styles.stepDot,
                      {
                        backgroundColor: isActive ? colors.primary : isDone ? colors.success : colors.surfaceAlt,
                        borderColor: isActive ? `${colors.primary}44` : 'transparent',
                      },
                    ]}>
                    <Icon
                      name={isDone && !isActive ? 'checkmark' : step.icon}
                      size={isActive ? 18 : 15}
                      color={isDone || isActive ? '#fff' : colors.textMuted}
                    />
                  </View>
                  <Txt
                    style={[
                      styles.stepLabel,
                      { color: isActive ? colors.primary : isDone ? colors.success : colors.textMuted },
                    ]}
                    numberOfLines={1}>
                    {t(step.label)}
                  </Txt>
                  <Txt style={[styles.stepTime, { color: colors.textMuted }]}>{isDone && at ? time(at) : ' '}</Txt>
                </View>
              );
            })}
          </Card>
        )}

        {showMap && (
          <View style={[styles.mapBox, { borderColor: colors.border }]}>
            <TrackingMap
              home={{ latitude: order.delivery_lat!, longitude: order.delivery_lng! }}
              rider={live ? { latitude: rider!.latitude!, longitude: rider!.longitude! } : null}
              color={colors.primary}
              homeLabel={t('yourHome')}
            />
            {live ? (
              <View style={[styles.liveBadge, { backgroundColor: colors.danger }]}>
                <View style={styles.liveDot} />
                <Txt style={styles.liveText}>{t('trackLive')}</Txt>
              </View>
            ) : onTheWay && order.rider_id ? (
              <View style={[styles.soonPill, { backgroundColor: colors.surface }]}>
                <Icon name="time-outline" size={18} color={colors.primary} />
                <Txt variant="caption" style={{ flex: 1, fontWeight: '600' }}>
                  {t('trackLiveSoon')}
                </Txt>
              </View>
            ) : null}
          </View>
        )}

        <Card style={{ gap: 14 }}>
          <View style={styles.headRow}>
            <View style={{ flex: 1, gap: 2 }}>
              {eta != null ? (
                <>
                  <Txt variant="caption" muted>
                    {t('etaLabel')}
                  </Txt>
                  <View style={styles.etaRow}>
                    <Txt style={[styles.eta, { color: colors.primary }]}>{eta}</Txt>
                    <Txt style={[styles.etaUnit, { color: colors.primary }]}>{t('minutesShort')}</Txt>
                  </View>
                </>
              ) : null}
              <Txt style={{ fontWeight: '800', fontSize: eta != null ? 15 : 20 }}>{t(headline)}</Txt>
              {order.scheduled_for && order.status === 'placed' ? (
                <Txt variant="caption" muted>
                  {t('scheduledFor', { time: formatSlot(new Date(order.scheduled_for), language) })}
                </Txt>
              ) : null}
            </View>
            <IconBadge
              name={
                order.status === 'cancelled'
                  ? 'close-circle-outline'
                  : order.status === 'delivered'
                    ? 'checkmark-circle-outline'
                    : onTheWay
                      ? 'delivery'
                      : 'flame-outline'
              }
              tone={order.status === 'cancelled' ? 'pink' : order.status === 'delivered' ? 'green' : 'orange'}
              size={64}
            />
          </View>

          {rider && order.status !== 'delivered' && (
            <View style={[styles.riderRow, { borderTopColor: colors.border }]}>
              <View style={[styles.avatar, { backgroundColor: `${colors.primary}18` }]}>
                <Icon name="delivery" size={26} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="caption" muted>
                  {t('yourRider')}
                </Txt>
                <Txt style={{ fontWeight: '800' }}>{rider.name}</Txt>
                <Txt variant="caption" muted>
                  {t(`vehicle_${rider.vehicle}` as TranslationKey)}
                </Txt>
              </View>
              <Pressable
                onPress={() => Linking.openURL(`tel:${rider.phone}`)}
                style={[styles.callButton, { backgroundColor: `${colors.success}18` }]}
                accessibilityRole="button"
                accessibilityLabel={t('callRider')}>
                <Icon name="call" size={22} color={colors.success} />
              </Pressable>
            </View>
          )}
        </Card>

        <Card style={{ gap: 10 }}>
          <View style={styles.summaryHead}>
            <IconBadge name="receipt-outline" tone="orange" size={32} />
            <View style={{ flex: 1 }}>
              <Txt style={{ fontWeight: '700' }}>{t('orderSummary')}</Txt>
              {chef ? (
                <Txt variant="caption" muted>
                  {l(chef.name)}
                </Txt>
              ) : null}
            </View>
            <Txt variant="caption" muted>
              #{order.id.slice(0, 6).toUpperCase()}
            </Txt>
          </View>
          {order.items.map((item) => {
            const dish = getDish(item.dishId);
            return (
              <View key={item.dishId} style={styles.itemRow}>
                <Txt style={{ fontWeight: '800', color: colors.primary, minWidth: 28 }}>{item.quantity}×</Txt>
                <Txt style={{ flex: 1 }} numberOfLines={1}>
                  {dish ? l(dish.name) : item.name}
                </Txt>
              </View>
            );
          })}
          <View style={[styles.itemRow, styles.totalRow, { borderTopColor: colors.border }]}>
            <Txt style={{ flex: 1, fontWeight: '600' }}>{t('total')}</Txt>
            <Txt style={{ fontWeight: '800', fontSize: 17 }}>{formatPrice(order.total)}</Txt>
          </View>
        </Card>

        {order.status === 'delivered' && (
          <Button icon="star-outline" title={t('rateOrder')} onPress={() => router.push(`/review/${order.id}`)} />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  help: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  steps: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 6 },
  step: { flex: 1, alignItems: 'center', gap: 5 },
  link: { position: 'absolute', top: 15, end: '50%', start: '-50%', height: 3, marginHorizontal: 20, borderRadius: 2 },
  linkPending: { opacity: 0.6 },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
  },
  stepLabel: { fontSize: 11.5, fontWeight: '700' },
  stepTime: { fontSize: 10.5 },
  mapBox: { height: 320, borderRadius: 22, overflow: 'hidden', borderWidth: 1 },
  liveBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  soonPill: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 14,
    boxShadow: '0px 2px 10px rgba(0,0,0,0.15)',
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  etaRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  eta: { fontFamily: FONT.extrabold, fontSize: 52, lineHeight: 58 },
  etaUnit: { fontFamily: FONT.bold, fontSize: 18, marginBottom: 9 },
  riderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  callButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  totalRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 2 },
});
