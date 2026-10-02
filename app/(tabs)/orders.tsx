import { router } from 'expo-router';
import { FlatList, Linking, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Button, Card, EmptyState, Icon, IconName, Screen, Txt } from '@/components/ui';
import { formatSlot } from '@/lib/schedule';
import { useCatalog } from '@/lib/catalog';
import { OrderStatus, useOrders } from '@/lib/orders';
import { useSettings } from '@/lib/settings';

const STATUS_ICON: Record<OrderStatus, IconName> = {
  placed: 'receipt-outline',
  cooking: 'flame-outline',
  on_the_way: 'delivery',
  delivered: 'checkmark-circle-outline',
  cancelled: 'close-circle-outline',
};

export default function OrdersScreen() {
  const { t, l, colors, formatPrice, language } = useSettings();
  const { orders, loading, refresh } = useOrders();
  const { getDish } = useCatalog();

  return (
    <Screen>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
        ListHeaderComponent={
          <Txt variant="title" style={{ marginTop: 8, marginBottom: 4 }}>
            {t('myOrders')}
          </Txt>
        }
        ListEmptyComponent={loading ? null : <EmptyState icon="bag-handle-outline" title={t('noOrders')} body={t('noOrdersBody')} />}
        renderItem={({ item }) => {
          const date = new Date(item.created_at).toLocaleString(language === 'ar' ? 'ar-EG' : language, {
            dateStyle: 'medium',
            timeStyle: 'short',
          });
          const count = item.items.reduce((n, i) => n + i.quantity, 0);
          return (
            <Card style={{ gap: 10 }}>
              <View style={styles.row}>
                <View style={[styles.statusIcon, { backgroundColor: colors.surfaceAlt }]}>
                  <Icon
                    name={STATUS_ICON[item.status] ?? 'receipt-outline'}
                    size={22}
                    color={item.status === 'cancelled' ? colors.danger : colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontWeight: '700' }}>{t(`status_${item.status}`)}</Txt>
                  <Txt variant="caption" muted>
                    {date} · {count} {t('items')}
                  </Txt>
                </View>
                <Txt style={{ fontWeight: '700' }}>{formatPrice(item.total)}</Txt>
              </View>
              <View style={styles.items}>
                {item.items.map((i) => {
                  const dish = getDish(i.dishId);
                  return (
                    <View key={i.dishId} style={[styles.item, { backgroundColor: colors.surfaceAlt }]}>
                      <Txt variant="caption" style={{ fontWeight: '500' }}>
                        {i.quantity}× {dish ? l(dish.name) : i.name}
                      </Txt>
                    </View>
                  );
                })}
              </View>
              <View style={styles.badges}>
                {item.points_earned > 0 && (
                  <View style={styles.row}>
                    <Icon name="sparkles-outline" size={16} color={colors.primary} />
                    <Txt variant="caption" style={{ color: colors.primary, fontWeight: '600' }}>
                      {t('pointsEarned', { n: item.points_earned })}
                    </Txt>
                  </View>
                )}
                {item.delivery_fee === 0 && (
                  <View style={styles.row}>
                    <Icon name="delivery" size={16} color={colors.success} />
                    <Txt variant="caption" style={{ color: colors.success, fontWeight: '600' }}>
                      {t('freeDeliveryBadge')}
                    </Txt>
                  </View>
                )}
                {item.credit_used > 0 && (
                  <View style={styles.row}>
                    <Icon name="wallet-outline" size={16} color={colors.success} />
                    <Txt variant="caption" style={{ color: colors.success, fontWeight: '600' }}>
                      {t('creditLine')} − {formatPrice(item.credit_used)}
                    </Txt>
                  </View>
                )}
                {item.discount > 0 && (
                  <View style={styles.row}>
                    <Icon name="pricetag-outline" size={16} color={colors.success} />
                    <Txt variant="caption" style={{ color: colors.success, fontWeight: '600' }}>
                      {t('discount')} − {formatPrice(item.discount)}
                    </Txt>
                  </View>
                )}
              </View>
              {item.scheduled_for && (
                <View style={styles.row}>
                  <Icon name="time-outline" size={16} />
                  <Txt variant="caption" style={{ fontWeight: '600' }}>
                    {t('scheduledFor', { time: formatSlot(new Date(item.scheduled_for), language) })}
                  </Txt>
                </View>
              )}
              {item.delivery_lat != null && item.delivery_lng != null && (
                <Pressable
                  onPress={() =>
                    Linking.openURL(
                      `https://www.google.com/maps/search/?api=1&query=${item.delivery_lat},${item.delivery_lng}`
                    )
                  }
                  style={styles.row}>
                  <Icon name="location-outline" size={16} color={colors.primary} />
                  <Txt variant="caption" style={{ color: colors.primary, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>
                    {item.address ?? t('openInMaps')}
                  </Txt>
                </Pressable>
              )}
              {item.status !== 'cancelled' && (
                <Button
                  small
                  variant="secondary"
                  icon="star-outline"
                  title={t('rateOrder')}
                  onPress={() => router.push(`/review/${item.id}`)}
                />
              )}
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6 },
  items: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
});
