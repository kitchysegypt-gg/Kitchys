import { useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Chip, EmptyState, Icon, IconBadge, IconName, ScreenHeader, Txt, filledIcon } from '@/components/ui';
import { showAlert, showConfirm } from '@/lib/alert';
import type { TranslationKey } from '@/lib/i18n';
import { ChefAction, KitchenOrder, canDecline, leaveKitchen, nextStep, useKitchen } from '@/lib/kitchen';
import { OrderRider, useOrderRiders } from '@/lib/orderRiders';
import type { OrderStatus } from '@/lib/orders';
import { formatSlot } from '@/lib/schedule';
import { useSettings } from '@/lib/settings';

const STATUS_ICON: Record<OrderStatus, IconName> = {
  placed: 'notifications-outline',
  cooking: 'flame-outline',
  ready: 'bag-check-outline',
  on_the_way: 'delivery',
  delivered: 'checkmark-circle-outline',
  cancelled: 'close-circle-outline',
};

/** Kitchen > Orders: new and active orders first, each moved along with one tap. */
export default function KitchenOrdersScreen() {
  const { t, colors } = useSettings();
  const { orders, openOrders, refreshOrders } = useKitchen();
  const [tab, setTab] = useState<'open' | 'past'>('open');
  const [refreshing, setRefreshing] = useState(false);

  const past = orders.filter((o) => o.status === 'delivered' || o.status === 'cancelled');
  // New orders first, then the ones cooking, then out for delivery; soonest delivery first.
  const rank: Record<string, number> = { placed: 0, cooking: 1, ready: 2, on_the_way: 3 };
  const due = (o: KitchenOrder) => new Date(o.scheduled_for ?? o.created_at).getTime();
  const open = [...openOrders].sort((a, b) => rank[a.status] - rank[b.status] || due(a) - due(b));
  const list = tab === 'open' ? open : past;
  const riders = useOrderRiders(open.filter((o) => o.rider_id).map((o) => o.id));

  const pull = async () => {
    setRefreshing(true);
    await refreshOrders();
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView edges={['top']}>
        <ScreenHeader title={t('kitchenOrders')} onBack={leaveKitchen} />
        <View style={styles.tabs}>
          <Chip label={`${t('activeOrders')} (${open.length})`} active={tab === 'open'} onPress={() => setTab('open')} />
          <Chip label={t('pastOrders')} active={tab === 'past'} onPress={() => setTab('past')} />
        </View>
      </SafeAreaView>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 12, paddingBottom: 40, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pull} tintColor={colors.primary} />}>
        {list.length === 0 ? (
          <EmptyState
            icon={tab === 'open' ? 'cafe-outline' : 'receipt-outline'}
            title={tab === 'open' ? t('noActiveOrders') : t('noPastOrders')}
            body={tab === 'open' ? t('noActiveOrdersBody') : undefined}
          />
        ) : (
          list.map((o) => <OrderCard key={o.id} order={o} rider={riders[o.id]} />)
        )}
      </ScrollView>
    </View>
  );
}

function OrderCard({ order, rider }: { order: KitchenOrder; rider?: OrderRider }) {
  const { t, colors, formatPrice, language } = useSettings();
  const { setOrderStatus } = useKitchen();
  const [busy, setBusy] = useState(false);
  const step = nextStep(order);
  const isNew = order.status === 'placed' && !order.accepted_at;
  const accepted = order.status === 'placed' && !!order.accepted_at;

  const move = async (status: ChefAction) => {
    setBusy(true);
    try {
      await setOrderStatus(order.id, status);
    } catch (e: any) {
      showAlert(t('error'), e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const decline = () =>
    showConfirm(t('declineOrderTitle'), t('declineOrderBody'), {
      label: t('declineOrder'),
      cancelLabel: t('cancel'),
      onConfirm: () => move('cancelled'),
    });

  const portions = order.items.reduce((n, i) => n + i.quantity, 0);

  return (
    <Card style={[{ gap: 10 }, isNew && { borderColor: colors.primary, borderWidth: 2 }]}>
      <View style={styles.head}>
        <View style={[styles.statusPill, { backgroundColor: isNew ? colors.primary : colors.surfaceAlt }]}>
          <Icon name={accepted ? 'checkmark-circle' : filledIcon(STATUS_ICON[order.status])} size={14} color={isNew ? colors.onPrimary : colors.text} />
          <Txt style={{ fontSize: 12, fontWeight: '700', color: isNew ? colors.onPrimary : colors.text }}>
            {isNew ? t('newOrder') : accepted ? t('status_accepted') : t(`status_${order.status}` as TranslationKey)}
          </Txt>
        </View>
        <Txt variant="caption" muted>
          #{order.id.slice(0, 6).toUpperCase()}
        </Txt>
      </View>

      <View style={styles.when}>
        <IconBadge name="time-outline" tone={order.scheduled_for ? 'blue' : 'orange'} size={30} />
        <Txt style={{ fontWeight: '700', flex: 1 }}>
          {order.scheduled_for
            ? t('deliverAt', { time: formatSlot(new Date(order.scheduled_for), language) })
            : t('deliverAsap')}
        </Txt>
      </View>

      <View style={{ gap: 4 }}>
        {order.items.map((item) => (
          <View key={item.dishId} style={styles.itemRow}>
            <Txt style={{ fontWeight: '800', minWidth: 30, color: colors.primary }}>{item.quantity}×</Txt>
            <Txt style={{ flex: 1 }}>{item.name}</Txt>
            <Txt variant="caption" muted>
              {formatPrice(item.price * item.quantity)}
            </Txt>
          </View>
        ))}
        <View style={[styles.itemRow, { borderTopWidth: 1, borderColor: colors.border, paddingTop: 6, marginTop: 2 }]}>
          <Txt variant="caption" muted style={{ flex: 1 }}>
            {t('portionsCount', { n: portions })}
          </Txt>
          <Txt style={{ fontWeight: '800' }}>{formatPrice(order.subtotal)}</Txt>
        </View>
      </View>

      {order.notes ? (
        <View style={[styles.note, { backgroundColor: colors.surfaceAlt }]}>
          <IconBadge name="chatbubble-ellipses-outline" tone="purple" size={26} />
          <Txt variant="caption" style={{ flex: 1 }}>
            {order.notes}
          </Txt>
        </View>
      ) : null}

      {rider ? (
        <View style={[styles.note, { backgroundColor: `${colors.primary}12` }]}>
          <IconBadge name="bicycle-outline" tone="orange" size={26} />
          <Txt variant="caption" style={{ flex: 1, fontWeight: '600' }}>
            {order.status === 'on_the_way' ? t('riderDelivering', { name: rider.name }) : t('riderComing', { name: rider.name })}
          </Txt>
          <Pressable onPress={() => Linking.openURL(`tel:${rider.phone}`)} hitSlop={8} accessibilityLabel={t('callRider')}>
            <IconBadge name="call-outline" tone="green" size={30} />
          </Pressable>
        </View>
      ) : order.status === 'ready' ? (
        <View style={[styles.note, { backgroundColor: colors.surfaceAlt }]}>
          <IconBadge name="time-outline" tone="amber" size={26} />
          <Txt variant="caption" style={{ flex: 1, fontWeight: '600' }}>
            {t('waitingForRider')}
          </Txt>
        </View>
      ) : order.status === 'placed' || order.status === 'cooking' ? (
        <View style={[styles.note, { backgroundColor: colors.surfaceAlt }]}>
          <IconBadge name="bicycle-outline" tone="orange" size={26} />
          <Txt variant="caption" style={{ flex: 1, fontWeight: '600' }}>
            {t('riderWillPickUp')}
          </Txt>
        </View>
      ) : null}

      {step?.lockedUntil && (
        <View style={[styles.note, { backgroundColor: `${colors.success}14` }]}>
          <IconBadge name="checkmark-circle-outline" tone="green" size={26} />
          <Txt variant="caption" style={{ flex: 1, fontWeight: '600' }}>
            {t('cookOnDay', {
              day: step.lockedUntil.toLocaleDateString(language === 'ar' ? 'ar-EG' : language, {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
              }),
            })}
          </Txt>
        </View>
      )}

      {step && (
        <View style={styles.actions}>
          {canDecline(order.status) && (
            <Button title={t('declineOrder')} variant="ghost" small onPress={decline} disabled={busy} />
          )}
          <Button
            title={t(step.label)}
            icon={step.icon}
            onPress={() => move(step.action)}
            loading={busy}
            disabled={!!step.lockedUntil}
            style={{ flex: 1 }}
          />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 4 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10 },
  when: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
