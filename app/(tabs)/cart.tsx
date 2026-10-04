import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Confetti } from '@/components/Confetti';
import { DishArt } from '@/components/media';
import { ScheduleValue, SchedulePicker } from '@/components/SchedulePicker';
import { FreeDeliveryBanner, QuantityStepper } from '@/components/menu';
import { Button, Card, Chip, EmptyState, Icon, Screen, Txt } from '@/components/ui';
import { useCart } from '@/lib/cart';
import { DELIVERY_RADIUS_KM, useCatalog } from '@/lib/catalog';
import { applyReward, getReward, pointsFor } from '@/lib/loyalty';
import {
  AFTER_CLOSED_FIRST_MINUTES,
  OPEN_MINUTES,
  formatTime,
  isBeforeAfterClosedStart,
  isKitchenOpen,
  isTooSoon,
  isWithinHours,
  slotDate,
} from '@/lib/schedule';
import { useOrders } from '@/lib/orders';
import { showAlert } from '@/lib/alert';
import { useSettings } from '@/lib/settings';
import { FONT } from '@/lib/fonts';
import { useSounds } from '@/lib/sound';
import { DELIVERY_FEE } from '@/lib/supabase';

export default function CartScreen() {
  const { t, l, colors, formatPrice, isRTL, location, language } = useSettings();
  const { lines, subtotal, setQuantity, clear } = useCart();
  const { getChef, isNear, lastDelivery } = useCatalog();
  const { freeDeliveriesLeft, placeOrder, availableVouchers, orderCount, orders, credit } = useOrders();
  const { playOrderSuccess } = useSounds();
  // Prefilled from the saved map location until the customer types their own.
  const [typedAddress, setAddress] = useState<string | null>(null);
  const address = typedAddress ?? (location ? [location.address, location.details].filter(Boolean).join(', ') : '');
  const [voucherId, setVoucherId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduleValue>({ mode: 'asap' });
  // Orders come from one chef, so the cart follows that chef's last delivery time.
  const cartChefId = lines[0]?.dish.chefId;
  const close = lastDelivery(cartChefId ?? '');
  const [earned, setEarned] = useState(0);
  const [notes, setNotes] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [useCredit, setUseCredit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [burst, setBurst] = useState(0);
  const [success, setSuccess] = useState(false);

  const baseDeliveryFee = freeDeliveriesLeft > 0 ? 0 : DELIVERY_FEE;
  const voucher = availableVouchers.find((v) => v.id === voucherId);
  const { discount, deliveryFee } = applyReward(voucher && getReward(voucher.reward_id), subtotal, baseDeliveryFee);
  const beforeCredit = subtotal - discount + deliveryFee;
  const creditUsed = useCredit ? Math.min(credit, beforeCredit) : 0;
  const total = beforeCredit - creditUsed;
  // Referral codes only work on a customer's very first order.
  const firstOrder = orders.length === 0;
  const clearBurst = useCallback(() => setBurst(0), []);

  const submit = async () => {
    if (!address.trim()) return showAlert(t('address'), t('addressRequired'));
    if (!location) {
      showAlert(t('location'), t('setAddressFirst'));
      return router.push('/location');
    }
    const farLine = lines.find((line) => !isNear(line.dish.chefId));
    if (farLine) {
      const chef = getChef(farLine.dish.chefId);
      return showAlert(t('tooFarTitle'), t('tooFarBody', { chef: chef ? l(chef.name) : '', km: DELIVERY_RADIUS_KM }));
    }
    const scheduledFor = schedule.mode === 'later' ? slotDate(schedule.day, schedule.minutes) : null;
    const hours = { from: formatTime(OPEN_MINUTES, language), to: formatTime(close, language) };
    if (!scheduledFor && !isKitchenOpen(new Date(), close)) {
      return showAlert(t('deliveryTime'), t('kitchenHours', hours));
    }
    if (scheduledFor && !isWithinHours(scheduledFor, close)) {
      return showAlert(t('deliveryTime'), t('kitchenHours', hours));
    }
    if (scheduledFor && isBeforeAfterClosedStart(scheduledFor, close)) {
      return showAlert(t('deliveryTime'), t('closedEarliest', { time: formatTime(AFTER_CLOSED_FIRST_MINUTES, language) }));
    }
    if (scheduledFor && isTooSoon(scheduledFor)) return showAlert(t('deliveryTime'), t('timeTooSoon'));
    setBusy(true);
    try {
      const order = await placeOrder({
        items: lines.map((line) => ({
          dishId: line.dish.id,
          name: line.dish.name.en,
          price: line.dish.price,
          quantity: line.quantity,
        })),
        subtotal,
        address: address.trim(),
        notes: notes.trim() || null,
        voucher_id: voucher?.id ?? null,
        referral_code: firstOrder && referralCode.trim() ? referralCode.trim().toUpperCase() : null,
        use_credit: creditUsed > 0,
        delivery_lat: location?.latitude ?? null,
        delivery_lng: location?.longitude ?? null,
        scheduled_for: scheduledFor?.toISOString() ?? null,
      });
      clear();
      setNotes('');
      setVoucherId(null);
      setReferralCode('');
      setUseCredit(false);
      setSchedule({ mode: 'asap' });
      setEarned(order.points_earned);
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
        <EmptyState icon="cart-outline" title={t('cartEmpty')} body={t('cartEmptyBody')}>
          <Button title={t('browseDishes')} onPress={() => router.navigate('/')} />
        </EmptyState>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled">
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
                  <Txt style={{ fontWeight: '700', marginTop: 2 }}>
                    {formatPrice(dish.price * quantity)}
                  </Txt>
                </View>
                <QuantityStepper value={quantity} onChange={(q) => setQuantity(dish.id, q)} />
              </Card>
            ))}

            <FreeDeliveryBanner />

            <Card style={{ gap: 10 }}>
              <View style={styles.row}>
                <Icon name="location-outline" size={18} color={colors.textMuted} />
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
              <Button
                small
                variant="secondary"
                icon="map-outline"
                title={location ? t('location') : t('pickOnMap')}
                onPress={() => router.push('/location')}
              />
              <View style={styles.row}>
                <Icon name="document-text-outline" size={18} color={colors.textMuted} />
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
            </Card>

            <SchedulePicker value={schedule} onChange={setSchedule} close={close} />

            {availableVouchers.length > 0 && (
              <Card style={{ gap: 10 }}>
                <View style={styles.row}>
                  <Icon name="pricetags-outline" size={18} color={colors.textMuted} />
                  <Txt variant="label" muted>
                    {t('applyVoucher')}
                  </Txt>
                </View>
                <View style={styles.chips}>
                  <Chip label={t('noVoucher')} active={!voucher} onPress={() => setVoucherId(null)} />
                  {availableVouchers.map((v) => {
                    const reward = getReward(v.reward_id);
                    const pointless = reward?.kind === 'free_delivery' && baseDeliveryFee === 0;
                    return (
                      <Chip
                        key={v.id}
                        label={reward ? t(reward.label) : v.reward_id}
                        icon={reward?.icon}
                        active={voucher?.id === v.id}
                        onPress={() => (pointless ? showAlert(t('deliveryAlreadyFree')) : setVoucherId(v.id))}
                      />
                    );
                  })}
                </View>
              </Card>
            )}

            {(firstOrder || credit > 0) && (
              <Card style={{ gap: 10 }}>
                {firstOrder && (
                  <>
                    <View style={styles.row}>
                      <Icon name="gift-outline" size={18} color={colors.textMuted} />
                      <Txt variant="label" muted>
                        {t('referralCode')}
                      </Txt>
                    </View>
                    <TextInput
                      value={referralCode}
                      onChangeText={(v) => setReferralCode(v.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
                      placeholder={t('referralPlaceholder')}
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={9}
                      style={[inputStyle, { letterSpacing: 2 }]}
                    />
                  </>
                )}
                {credit > 0 && (
                  <View style={styles.row}>
                    <Icon name="wallet-outline" size={20} color={colors.success} />
                    <Txt style={{ flex: 1, fontWeight: '600' }}>{t('useCredit', { amount: formatPrice(credit) })}</Txt>
                    <Switch
                      value={useCredit}
                      onValueChange={setUseCredit}
                      trackColor={{ true: colors.primary, false: colors.border }}
                      thumbColor="#fff"
                    />
                  </View>
                )}
              </Card>
            )}

            <Card style={{ gap: 8 }}>
              <SummaryRow label={t('subtotal')} value={formatPrice(subtotal)} />
              {discount > 0 && (
                <SummaryRow label={t('discount')} value={`− ${formatPrice(discount)}`} valueColor={colors.success} />
              )}
              <SummaryRow
                label={t('delivery')}
                value={deliveryFee === 0 ? t('free') : formatPrice(deliveryFee)}
                valueColor={deliveryFee === 0 ? colors.success : undefined}
                strike={deliveryFee === 0 ? formatPrice(DELIVERY_FEE) : undefined}
              />
              {creditUsed > 0 && (
                <SummaryRow label={t('creditLine')} value={`− ${formatPrice(creditUsed)}`} valueColor={colors.success} />
              )}
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <SummaryRow label={t('total')} value={formatPrice(total)} big />
              <View style={styles.row}>
                <Icon name="sparkles-outline" size={16} color={colors.primary} />
                <Txt variant="caption" style={{ fontWeight: '600', color: colors.primary }}>
                  {t('youWillEarn', { n: pointsFor(subtotal - discount, orderCount) })}
                </Txt>
              </View>
            </Card>

            <Button
              title={`${t('placeOrder')} · ${formatPrice(total)}`}
              onPress={submit}
              loading={busy}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <Modal visible={success} transparent animationType="fade" onRequestClose={() => setSuccess(false)}>
        <View style={styles.backdrop}>
          <Card style={{ padding: 24, alignItems: 'center' }}>
            <View style={[styles.successIcon, { backgroundColor: colors.successBg }]}>
              <Icon name="checkmark" size={48} color={colors.success} />
            </View>
            <Txt variant="title" center style={{ marginTop: 16 }}>
              {t('orderPlaced')}
            </Txt>
            <Txt muted center style={{ marginVertical: 12 }}>
              {t('orderPlacedBody')}
            </Txt>
            {earned > 0 && (
              <View style={[styles.row, styles.earnedPill, { backgroundColor: colors.surfaceAlt }]}>
                <Icon name="sparkles" size={20} color={colors.primary} />
                <Txt variant="heading" style={{ color: colors.primary }}>
                  {t('pointsEarned', { n: earned })}
                </Txt>
              </View>
            )}
            <Button
              title={t('viewOrders')}
              style={{ alignSelf: 'stretch' }}
              onPress={() => {
                setSuccess(false);
                router.navigate('/orders');
              }}
            />
          </Card>
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
        <Txt variant={big ? 'heading' : 'body'} color={valueColor} style={{ fontWeight: big ? '700' : '600' }}>
          {value}
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  successIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  lineArt: { width: 64, height: 64 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  earnedPill: { borderRadius: 16, paddingVertical: 8, paddingHorizontal: 14, marginBottom: 14 },
  input: { borderRadius: 14, borderWidth: 1, padding: 12, fontSize: 15, fontFamily: FONT.regular, minHeight: 48 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  divider: { height: 1, marginVertical: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
});
