import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Confetti } from '@/components/Confetti';
import { Emoji3D } from '@/components/Emoji3D';
import { FreeDeliveryBanner, QuantityStepper } from '@/components/menu';
import { Button3D, Card3D, EmptyState, Screen, Txt } from '@/components/ui';
import { getChef } from '@/data/menu';
import { useCart } from '@/lib/cart';
import { useOrders } from '@/lib/orders';
import { showAlert } from '@/lib/alert';
import { useSettings } from '@/lib/settings';
import { useSounds } from '@/lib/sound';
import { DELIVERY_FEE } from '@/lib/supabase';

export default function CartScreen() {
  const { t, l, colors, formatPrice, isRTL } = useSettings();
  const { lines, subtotal, setQuantity, clear } = useCart();
  const { freeDeliveriesLeft, placeOrder } = useOrders();
  const { playOrderSuccess } = useSounds();
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [burst, setBurst] = useState(0);
  const [success, setSuccess] = useState(false);

  const deliveryFee = freeDeliveriesLeft > 0 ? 0 : DELIVERY_FEE;
  const clearBurst = useCallback(() => setBurst(0), []);

  const submit = async () => {
    if (!address.trim()) return showAlert(t('address'), t('addressRequired'));
    setBusy(true);
    try {
      await placeOrder({
        items: lines.map((line) => ({
          dishId: line.dish.id,
          name: line.dish.name.en,
          price: line.dish.price,
          quantity: line.quantity,
        })),
        subtotal,
        address: address.trim(),
        notes: notes.trim() || null,
      });
      clear();
      setNotes('');
      setSuccess(true);
      setBurst(Date.now());
      playOrderSuccess();
    } catch (e: any) {
      showAlert(t('error'), e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.border,
      color: colors.text,
      textAlign: isRTL ? 'right' : 'left',
    } as const,
  ];

  return (
    <Screen>
      {lines.length === 0 ? (
        <EmptyState emoji="cart" title={t('cartEmpty')} body={t('cartEmptyBody')}>
          <Button3D title={t('browseDishes')} emoji="steaming_bowl" onPress={() => router.navigate('/')} />
        </EmptyState>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Emoji3D name="cart" size={52} float sway />
              <Txt variant="title">{t('yourCart')}</Txt>
            </View>

            {lines.map(({ dish, quantity }) => (
              <Card3D key={dish.id} style={styles.line}>
                <View style={[styles.lineArt, { backgroundColor: getChef(dish.chefId)?.color }]}>
                  <Emoji3D name={dish.emoji} size={48} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontWeight: '800' }} numberOfLines={1}>
                    {l(dish.name)}
                  </Txt>
                  <Txt variant="caption" muted numberOfLines={1}>
                    {l(getChef(dish.chefId)!.name)}
                  </Txt>
                  <Txt style={{ fontWeight: '900', color: colors.primary, marginTop: 2 }}>
                    {formatPrice(dish.price * quantity)}
                  </Txt>
                </View>
                <QuantityStepper value={quantity} onChange={(q) => setQuantity(dish.id, q)} />
              </Card3D>
            ))}

            <FreeDeliveryBanner />

            <Card3D style={{ gap: 10 }}>
              <View style={styles.row}>
                <Emoji3D name="house" size={24} />
                <Txt variant="label" muted>
                  {t('address')}
                </Txt>
              </View>
              <TextInput
                value={address}
                onChangeText={setAddress}
                placeholder={t('addressPlaceholder')}
                placeholderTextColor={colors.textMuted}
                style={inputStyle}
                multiline
              />
              <View style={styles.row}>
                <Emoji3D name="clipboard" size={24} />
                <Txt variant="label" muted>
                  {t('notes')}
                </Txt>
              </View>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={t('notesPlaceholder')}
                placeholderTextColor={colors.textMuted}
                style={inputStyle}
                multiline
              />
            </Card3D>

            <Card3D style={{ gap: 8 }}>
              <SummaryRow label={t('subtotal')} value={formatPrice(subtotal)} />
              <SummaryRow
                label={t('delivery')}
                value={deliveryFee === 0 ? `${t('free')} 🎉` : formatPrice(deliveryFee)}
                valueColor={deliveryFee === 0 ? colors.success : undefined}
                strike={deliveryFee === 0 ? formatPrice(DELIVERY_FEE) : undefined}
              />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <SummaryRow label={t('total')} value={formatPrice(subtotal + deliveryFee)} big />
            </Card3D>

            <Button3D
              title={`${t('placeOrder')} · ${formatPrice(subtotal + deliveryFee)}`}
              emoji="bags"
              onPress={submit}
              loading={busy}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <Modal visible={success} transparent animationType="fade" onRequestClose={() => setSuccess(false)}>
        <View style={styles.backdrop}>
          <Card3D style={{ padding: 24, alignItems: 'center' }}>
            <Emoji3D name="party" size={130} float sway />
            <Txt variant="title" center style={{ marginTop: 10 }}>
              {t('orderPlaced')}
            </Txt>
            <Txt muted center style={{ marginVertical: 12 }}>
              {t('orderPlacedBody')}
            </Txt>
            <Button3D
              title={t('viewOrders')}
              emoji="receipt"
              style={{ alignSelf: 'stretch' }}
              onPress={() => {
                setSuccess(false);
                router.navigate('/orders');
              }}
            />
          </Card3D>
        </View>
        {/* Confetti sits above the success card, inside the modal so it's on top. */}
        <Confetti burstKey={burst} onDone={clearBurst} />
      </Modal>
    </Screen>
  );
}

function SummaryRow({
  label,
  value,
  big,
  valueColor,
  strike,
}: {
  label: string;
  value: string;
  big?: boolean;
  valueColor?: string;
  strike?: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <Txt variant={big ? 'heading' : 'body'} muted={!big}>
        {label}
      </Txt>
      <View style={styles.row}>
        {strike && (
          <Txt muted style={{ textDecorationLine: 'line-through' }}>
            {strike}
          </Txt>
        )}
        <Txt variant={big ? 'heading' : 'body'} color={valueColor} style={{ fontWeight: '900' }}>
          {value}
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  lineArt: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  input: { borderRadius: 14, borderWidth: 1, padding: 12, fontSize: 15, minHeight: 48 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  divider: { height: 1, marginVertical: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
});
