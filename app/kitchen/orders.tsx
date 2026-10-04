import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Chip, EmptyState, Icon, IconName, ScreenHeader, Txt } from '@/components/ui';
import { showAlert, showConfirm } from '@/lib/alert';
import type { TranslationKey } from '@/lib/i18n';
import { KitchenOrder, canDecline, leaveKitchen, nextStatus, useKitchen } from '@/lib/kitchen';
import type { OrderStatus } from '@/lib/orders';
import { formatSlot } from '@/lib/schedule';
import { useSettings } from '@/lib/settings';

/** The button that moves an order to its next step. */
const NEXT_ACTION: Partial<Record<OrderStatus, { label: TranslationKey; icon: IconName }>> = {
  placed: { label: 'acceptAndCook', icon: 'flame-outline' },
  cooking: { label: 'sendOut', icon: 'delivery' },
  on_the_way: { label: 'markDelivered', icon: 'checkmark-done-outline' },
};

const STATUS_ICON: Record<OrderStatus, IconName> = {
  placed: 'notifications-outline',
  cooking: 'flame-outline',
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
  const rank: Record<string, number> = { placed: 0, cooking: 1, on_the_way: 2 };
  const due = (o: KitchenOrder) => new Date(o.scheduled_for ?? o.created_at).getTime();
  const open = [...openOrders].sort((a, b) => rank[a.status] - rank[b.status] || due(a) - due(b));
  const list = tab === 'open' ? open : past;

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
          list.map((o) => <OrderCard key={o.id} order={o} />)
        )}
      </ScrollView>
    </View>
  );
}

function OrderCard({ order }: { order: KitchenOrder }) {
  const { t, colors, formatPrice, language } = useSettings();
  const { setOrderStatus } = useKitchen();
  const [busy, setBusy] = useState(false);
  const next = nextStatus(order.status);
  const action = NEXT_ACTION[order.status];
  const isNew = order.status === 'placed';

  const move = async (status: OrderStatus) => {
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
          <Icon name={STATUS_ICON[order.status]} size={14} color={isNew ? colors.onPrimary : colors.text} />
          <Txt style={{ fontSize: 12, fontWeight: '700', color: isNew ? colors.onPrimary : colors.text }}>
            {isNew ? t('newOrder') : t(`status_${order.status}` as TranslationKey)}
          </Txt>
        </View>
        <Txt variant="caption" muted>
          #{order.id.slice(0, 6).toUpperCase()}
        </Txt>
      </View>

      <View style={styles.when}>
        <Icon name="time-outline" size={16} color={colors.primary} />
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
          <Icon name="chatbubble-ellipses-outline" size={16} color={colors.textMuted} />
          <Txt variant="caption" style={{ flex: 1 }}>
            {order.notes}
          </Txt>
        </View>
      ) : null}

      <View style={styles.when}>
        <Icon name="location-outline" size={16} color={colors.textMuted} />
        <Txt variant="caption" muted style={{ flex: 1 }}>
          {order.address}
        </Txt>
      </View>

      {next && action && (
        <View style={styles.actions}>
          {canDecline(order.status) && (
            <Button title={t('declineOrder')} variant="ghost" small onPress={decline} disabled={busy} />
          )}
          <Button
            title={t(action.label)}
            icon={action.icon}
            onPress={() => move(next)}
            loading={busy}
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
  when: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  note: { flexDirection: 'row', gap: 8, padding: 10, borderRadius: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
