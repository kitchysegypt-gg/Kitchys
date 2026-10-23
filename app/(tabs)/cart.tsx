import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { DishArt } from '@/components/media';
import { FreeDeliveryBanner, QuantityStepper } from '@/components/menu';
import { Button, Card, EmptyState, Screen, Txt } from '@/components/ui';
import { useCart } from '@/lib/cart';
import { useCatalog } from '@/lib/catalog';
import { useSettings } from '@/lib/settings';

/** The cart: dishes and quantities. Delivery, payment and the bill are on the checkout screen. */
export default function CartScreen() {
  const { t, l, colors, formatPrice } = useSettings();
  const { lines, subtotal, setQuantity } = useCart();
  const { getChef } = useCatalog();

  return (
    <Screen>
      {lines.length === 0 ? (
        <EmptyState icon="cart-outline" title={t('cartEmpty')} body={t('cartEmptyBody')}>
          <Button title={t('browseDishes')} onPress={() => router.navigate('/')} />
        </EmptyState>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>
            <Txt variant="title" style={{ marginTop: 8 }}>
              {t('yourCart')}
            </Txt>

            {lines.map(({ dish, quantity }) => (
              <Card key={dish.id} style={styles.line}>
                <View style={styles.lineArt}>
                  <DishArt dish={dish} height={64} radius={14} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontWeight: '700' }} numberOfLines={1}>
                    {l(dish.name)}
                  </Txt>
                  <Txt variant="caption" muted numberOfLines={1}>
                    {getChef(dish.chefId) ? l(getChef(dish.chefId)!.name) : ''}
                  </Txt>
                  <Txt style={{ fontWeight: '700', marginTop: 2 }}>{formatPrice(dish.price * quantity)}</Txt>
                </View>
                <QuantityStepper value={quantity} onChange={(q) => setQuantity(dish.id, q)} />
              </Card>
            ))}

            <FreeDeliveryBanner />
          </ScrollView>

          <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <View style={styles.summaryRow}>
              <Txt muted>{t('subtotal')}</Txt>
              <Txt style={{ fontWeight: '700' }}>{formatPrice(subtotal)}</Txt>
            </View>
            <Button title={t('goToCheckout')} icon="arrow-forward" onPress={() => router.push('/checkout')} />
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  lineArt: { width: 64, height: 64 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footer: { padding: 16, gap: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
