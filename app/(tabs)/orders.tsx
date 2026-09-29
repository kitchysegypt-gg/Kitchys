import { FlatList, Linking, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Emoji3D } from '@/components/Emoji3D';
import { Card3D, EmptyState, Screen, Txt } from '@/components/ui';
import { getDish } from '@/data/menu';
import { EmojiName } from '@/lib/emoji';
import { OrderStatus, useOrders } from '@/lib/orders';
import { useSettings } from '@/lib/settings';

const STATUS_EMOJI: Record<OrderStatus, EmojiName> = {
  placed: 'receipt',
  cooking: 'cooking',
  on_the_way: 'scooter',
  delivered: 'check',
  cancelled: 'cross_mark',
};

export default function OrdersScreen() {
  const { t, l, colors, formatPrice, language } = useSettings();
  const { orders, loading, refresh } = useOrders();

  return (
    <Screen>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
        contentContainerStyle={{ padding: 20, gap: 14, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Emoji3D name="receipt" size={52} />
            <Txt variant="title">{t('myOrders')}</Txt>
          </View>
        }
        ListEmptyComponent={loading ? null : <EmptyState emoji="bags" title={t('noOrders')} body={t('noOrdersBody')} />}
        renderItem={({ item }) => {
          const date = new Date(item.created_at).toLocaleString(language === 'ar' ? 'ar-EG' : language, {
            dateStyle: 'medium',
            timeStyle: 'short',
          });
          const count = item.items.reduce((n, i) => n + i.quantity, 0);
          return (
            <Card3D style={{ gap: 10 }}>
              <View style={styles.row}>
                <Emoji3D name={STATUS_EMOJI[item.status] ?? 'receipt'} size={40} />
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontWeight: '800' }}>{t(`status_${item.status}`)}</Txt>
                  <Txt variant="caption" muted>
                    {date} · {count} {t('items')}
                  </Txt>
                </View>
                <Txt style={{ fontWeight: '900', color: colors.primary }}>{formatPrice(item.total)}</Txt>
              </View>
              <View style={styles.items}>
                {item.items.map((i) => {
                  const dish = getDish(i.dishId);
                  return (
                    <View key={i.dishId} style={[styles.item, { backgroundColor: colors.surfaceAlt }]}>
                      {dish && <Emoji3D name={dish.emoji} size={22} />}
                      <Txt variant="caption" style={{ fontWeight: '700' }}>
                        {i.quantity}× {dish ? l(dish.name) : i.name}
                      </Txt>
                    </View>
                  );
                })}
              </View>
              <View style={styles.badges}>
                {item.points_earned > 0 && (
                  <View style={styles.row}>
                    <Emoji3D name="coin" size={20} />
                    <Txt variant="caption" style={{ color: colors.primary, fontWeight: '800' }}>
                      {t('pointsEarned', { n: item.points_earned })}
                    </Txt>
                  </View>
                )}
                {item.delivery_fee === 0 && (
                  <View style={styles.row}>
                    <Emoji3D name="truck" size={20} />
                    <Txt variant="caption" style={{ color: colors.success, fontWeight: '800' }}>
                      {t('freeDeliveryBadge')}
                    </Txt>
                  </View>
                )}
                {item.discount > 0 && (
                  <View style={styles.row}>
                    <Emoji3D name="ticket" size={20} />
                    <Txt variant="caption" style={{ color: colors.success, fontWeight: '800' }}>
                      {t('discount')} − {formatPrice(item.discount)}
                    </Txt>
                  </View>
                )}
              </View>
              {item.delivery_lat != null && item.delivery_lng != null && (
                <Pressable
                  onPress={() =>
                    Linking.openURL(
                      `https://www.google.com/maps/search/?api=1&query=${item.delivery_lat},${item.delivery_lng}`
                    )
                  }
                  style={styles.row}>
                  <Emoji3D name="pin" size={20} />
                  <Txt variant="caption" style={{ color: colors.primary, fontWeight: '700' }} numberOfLines={1}>
                    {item.address ?? t('openInMaps')} ↗
                  </Txt>
                </Pressable>
              )}
            </Card3D>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
