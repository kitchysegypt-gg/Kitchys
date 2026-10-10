import { useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, EmptyState, Icon, IconBadge, Txt } from '@/components/ui';
import { showAlert, showConfirm } from '@/lib/alert';
import type { TranslationKey } from '@/lib/i18n';
import { mapsLink } from '@/lib/orderRiders';
import { RiderOrder, useRider } from '@/lib/rider';
import { useSettings } from '@/lib/settings';

/** Rider > Deliveries: go online, your active deliveries step by step, and orders to take. */
export default function RiderDeliveriesScreen() {
  const { t, colors, formatPrice } = useSettings();
  const { online, setOnline, available, active, mine, refresh, locationAllowed } = useRider();
  const [refreshing, setRefreshing] = useState(false);
  const [switching, setSwitching] = useState(false);
  const doneToday = mine.filter((o) => o.status === 'delivered');

  const pull = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const toggle = async (value: boolean) => {
    setSwitching(true);
    try {
      await setOnline(value);
    } catch (e: any) {
      showAlert(t('error'), e?.message ?? String(e));
    } finally {
      setSwitching(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pull} tintColor={colors.primary} />}>
        <Txt variant="title">{t('riderAppName')}</Txt>

        <Card style={[styles.onlineCard, online && { borderColor: colors.success, borderWidth: 2 }]}>
          <View style={[styles.dot, { backgroundColor: online ? colors.success : colors.textMuted }]} />
          <View style={{ flex: 1 }}>
            <Txt style={{ fontWeight: '800', fontSize: 17 }}>{online ? t('riderOnline') : t('riderOffline')}</Txt>
            <Txt variant="caption" muted>
              {online ? t('riderOnlineBody') : t('riderOfflineBody')}
            </Txt>
          </View>
          <Switch
            value={online}
            onValueChange={toggle}
            disabled={switching}
            trackColor={{ true: colors.success, false: colors.border }}
            thumbColor="#fff"
            accessibilityLabel={online ? t('riderOnline') : t('riderOffline')}
          />
        </Card>

        {online && !locationAllowed && (
          <View style={[styles.note, { backgroundColor: `${colors.danger}12` }]}>
            <Icon name="location-outline" size={20} color={colors.danger} />
            <Txt variant="caption" style={{ flex: 1, fontWeight: '600' }}>
              {t('riderLocationOff')}
            </Txt>
          </View>
        )}

        {active.length > 0 && (
          <>
            <Txt variant="heading">{t('riderMyDeliveries')}</Txt>
            {active.map((o) => (
              <ActiveCard key={o.id} order={o} />
            ))}
          </>
        )}

        <Txt variant="heading">{t('riderAvailable')}</Txt>
        {!online ? (
          <EmptyState icon="moon-outline" title={t('riderOffline')} body={t('riderOfflineBody')} />
        ) : available.length === 0 ? (
          <EmptyState icon="bicycle-outline" title={t('riderNoAvailable')} body={t('riderNoAvailableBody')} />
        ) : (
          available.map((o) => <AvailableCard key={o.id} order={o} />)
        )}

        {doneToday.length > 0 && (
          <>
            <Txt variant="heading">{t('riderDoneToday')}</Txt>
            {doneToday.map((o) => (
              <View key={o.id} style={[styles.doneRow, { borderColor: colors.border }]}>
                <Icon name="checkmark-circle" size={20} color={colors.success} />
                <Txt style={{ flex: 1 }} numberOfLines={1}>
                  {o.chef.area ?? o.chef.name} → {o.customer.address ?? ''}
                </Txt>
                <Txt style={{ fontWeight: '700' }}>{formatPrice(o.cash)}</Txt>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusPill({ status }: { status: RiderOrder['status'] }) {
  const { t, colors } = useSettings();
  const ready = status === 'ready';
  return (
    <View style={[styles.pill, { backgroundColor: ready ? colors.success : colors.surfaceAlt }]}>
      <Txt style={{ fontSize: 12, fontWeight: '800', color: ready ? '#fff' : colors.text }}>
        {t(`status_${status}` as TranslationKey)}
      </Txt>
    </View>
  );
}

/** An order waiting for a rider. */
function AvailableCard({ order }: { order: RiderOrder }) {
  const { t, colors, formatPrice } = useSettings();
  const { claim } = useRider();
  const [busy, setBusy] = useState(false);

  const take = async () => {
    setBusy(true);
    try {
      await claim(order.id);
    } catch (e: any) {
      showAlert(t('error'), e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ gap: 10 }}>
      <View style={styles.head}>
        <StatusPill status={order.status} />
        <View style={{ alignItems: 'flex-end' }}>
          <Txt style={{ fontWeight: '800', fontSize: 18, color: colors.success }}>
            {t('riderYouEarn', { amount: formatPrice(order.pay) })}
          </Txt>
          {order.tip > 0 ? (
            <Txt variant="caption" muted>
              {t('riderTipIncluded', { amount: formatPrice(order.tip) })}
            </Txt>
          ) : null}
        </View>
      </View>
      <View style={styles.line}>
        <IconBadge name="restaurant-outline" tone="orange" size={30} />
        <View style={{ flex: 1 }}>
          <Txt style={{ fontWeight: '700' }}>{order.chef.area ?? order.chef.name}</Txt>
          <Txt variant="caption" muted>
            {[
              order.to_kitchen_km != null ? t('riderToKitchen', { km: order.to_kitchen_km }) : null,
              order.trip_km != null ? t('riderTrip', { km: order.trip_km }) : null,
              t('riderItems', { n: order.items }),
            ]
              .filter(Boolean)
              .join(' · ')}
          </Txt>
        </View>
      </View>
      <Button title={t('riderTake')} icon="hand-right-outline" onPress={take} loading={busy} />
    </Card>
  );
}

/** One of the rider's deliveries: where to go, who to call, and the next step. */
function ActiveCard({ order }: { order: RiderOrder }) {
  const { t, colors, formatPrice } = useSettings();
  const { setStep, release } = useRider();
  const [busy, setBusy] = useState(false);
  const pickedUp = order.status === 'on_the_way';

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (e: any) {
      showAlert(t('error'), e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const delivered = () =>
    showConfirm(
      t('riderDeliveredTitle'),
      t('riderDeliveredBody', {
        amount: formatPrice(order.cash),
        pay: formatPrice(order.pay),
        rest: formatPrice(Math.max(0, order.cash - order.pay)),
      }),
      {
        label: t('riderDelivered'),
        cancelLabel: t('cancel'),
        onConfirm: () => run(() => setStep(order.id, 'delivered')),
      }
    );

  const giveBack = () =>
    showConfirm(t('riderGiveBackTitle'), t('riderGiveBackBody'), {
      label: t('riderGiveBack'),
      cancelLabel: t('cancel'),
      onConfirm: () => run(() => release(order.id)),
    });

  return (
    <Card style={{ gap: 12, borderColor: colors.primary, borderWidth: 2 }}>
      <View style={styles.head}>
        <StatusPill status={order.status} />
        <Txt variant="caption" muted>
          {t('riderOrderNo', { id: order.id.slice(0, 6).toUpperCase() })}
        </Txt>
      </View>

      <View style={[styles.cash, { backgroundColor: `${colors.success}14` }]}>
        <Icon name="cash-outline" size={22} color={colors.success} />
        <Txt style={{ flex: 1, fontWeight: '600' }}>{t('riderCash')}</Txt>
        <Txt style={{ fontWeight: '800', fontSize: 20 }}>{formatPrice(order.cash)}</Txt>
      </View>
      <Txt variant="caption" muted style={{ marginTop: -6 }}>
        {order.cash >= order.pay
          ? t('riderKeepLine', {
              pay: formatPrice(order.pay),
              tip: formatPrice(order.tip),
              rest: formatPrice(order.cash - order.pay),
            })
          : // Small order (mostly paid with credit): Kitchy's pays the rider the difference.
            t('riderKitchysPaysLine', { pay: formatPrice(order.pay), owed: formatPrice(order.pay - order.cash) })}
      </Txt>

      <Stop
        done={pickedUp}
        icon="restaurant-outline"
        tone="orange"
        label={t('riderPickup')}
        title={order.chef.name}
        detail={order.chef.area}
        lat={order.chef.lat}
        lng={order.chef.lng}
        phone={order.chef.phone}
      />
      <Stop
        icon="home-outline"
        tone="blue"
        label={t('riderDropoff')}
        title={order.customer.name || order.customer.address || ''}
        detail={[order.customer.name ? order.customer.address : null, order.customer.notes].filter(Boolean).join('\n')}
        lat={order.customer.lat}
        lng={order.customer.lng}
        phone={order.customer.phone}
      />

      {order.status === 'cooking' && (
        <View style={[styles.note, { backgroundColor: colors.surfaceAlt }]}>
          <Icon name="flame-outline" size={18} color={colors.primary} />
          <Txt variant="caption" style={{ flex: 1, fontWeight: '600' }}>
            {t('riderStillCooking')}
          </Txt>
        </View>
      )}

      {pickedUp ? (
        <Button title={t('riderDelivered')} icon="checkmark-done" onPress={delivered} loading={busy} />
      ) : (
        <View style={styles.actions}>
          <Button title={t('riderGiveBack')} variant="ghost" small onPress={giveBack} disabled={busy} />
          <Button
            title={t('riderPickedUp')}
            icon="bag-check-outline"
            onPress={() => run(() => setStep(order.id, 'picked_up'))}
            loading={busy}
            style={{ flex: 1 }}
          />
        </View>
      )}
    </Card>
  );
}

/** A pickup or drop-off: place, address, and buttons for directions and calling. */
function Stop({
  icon,
  tone,
  label,
  title,
  detail,
  lat,
  lng,
  phone,
  done,
}: {
  icon: 'restaurant-outline' | 'home-outline';
  tone: 'orange' | 'blue';
  label: string;
  title: string;
  detail?: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  done?: boolean;
}) {
  const { t, colors } = useSettings();
  return (
    <View style={[styles.stop, { borderColor: colors.border, opacity: done ? 0.55 : 1 }]}>
      <View style={styles.line}>
        <IconBadge name={done ? 'checkmark-circle-outline' : icon} tone={done ? 'green' : tone} size={30} />
        <View style={{ flex: 1 }}>
          <Txt variant="caption" muted>
            {label}
          </Txt>
          <Txt style={{ fontWeight: '700' }}>{title}</Txt>
          {detail ? (
            <Txt variant="caption" muted>
              {detail}
            </Txt>
          ) : null}
        </View>
      </View>
      {!done && (
        <View style={styles.actions}>
          {lat != null && lng != null && (
            <Button
              small
              variant="secondary"
              icon="navigate-outline"
              title={t('riderDirections')}
              onPress={() => Linking.openURL(mapsLink(lat, lng))}
              style={{ flex: 1 }}
            />
          )}
          {phone && (
            <Button
              small
              variant="secondary"
              icon="call-outline"
              title={t('riderCall')}
              onPress={() => Linking.openURL(`tel:${phone}`)}
              style={{ flex: 1 }}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  onlineCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cash: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14 },
  stop: { gap: 10, padding: 12, borderRadius: 14, borderWidth: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});
