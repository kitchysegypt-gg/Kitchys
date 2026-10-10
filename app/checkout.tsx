import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScheduleValue, SchedulePicker } from '@/components/SchedulePicker';
import { Button, Card, Chip, Icon, IconName, Screen, ScreenHeader, Txt } from '@/components/ui';
import { showAlert } from '@/lib/alert';
import { useCart } from '@/lib/cart';
import { DELIVERY_RADIUS_KM, useCatalog } from '@/lib/catalog';
import { FONT } from '@/lib/fonts';
import { applyReward, getReward, pointsFor } from '@/lib/loyalty';
import { useOrders } from '@/lib/orders';
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
import { useSettings } from '@/lib/settings';
import { DELIVERY_FEE, FREE_DELIVERY_ORDERS, SERVICE_FEE } from '@/lib/supabase';

/**
 * Checkout, after the cart: delivery time, address and note, payment, rewards and balance,
 * then the bill (subtotal, delivery, service fee, grand total) and "Place order".
 */
export default function CheckoutScreen() {
  const { t, l, colors, formatPrice, isRTL, location, language } = useSettings();
  const { lines, subtotal, clear } = useCart();
  const { getChef, isNear, lastDelivery } = useCatalog();
  const { freeDeliveriesLeft, placeOrder, availableVouchers, orderCount, orders, credit } = useOrders();
  // Prefilled from the saved map location until the customer types their own.
  const [typedAddress, setAddress] = useState<string | null>(null);
  const address = typedAddress ?? (location ? [location.address, location.details].filter(Boolean).join(', ') : '');
  const [voucherId, setVoucherId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduleValue>({ mode: 'asap' });
  // Orders come from one chef, so checkout follows that chef's last delivery time.
  const close = lastDelivery(lines[0]?.dish.chefId ?? '');
  const [earned, setEarned] = useState(0);
  const [notes, setNotes] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [useCredit, setUseCredit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  const baseDeliveryFee = freeDeliveriesLeft > 0 ? 0 : DELIVERY_FEE;
  const voucher = availableVouchers.find((v) => v.id === voucherId);
  const { discount, deliveryFee } = applyReward(voucher && getReward(voucher.reward_id), subtotal, baseDeliveryFee);
  const beforeCredit = subtotal - discount + deliveryFee + SERVICE_FEE;
  const creditUsed = useCredit ? Math.min(credit, beforeCredit) : 0;
  const total = beforeCredit - creditUsed;
  // Referral codes only work on a customer's very first order.
  const firstOrder = orders.length === 0;
  const points = pointsFor(subtotal - discount, orderCount);

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
      setEarned(order.points_earned);
      setSuccess(true);
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

  // Nothing to check out (e.g. the order was just placed, or the cart was emptied).
  if (lines.length === 0 && !success) {
    return (
      <Screen>
        <ScreenHeader title={t('checkout')} />
        <View style={{ padding: 16 }}>
          <Button title={t('browseDishes')} onPress={() => router.replace('/')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title={t('checkout')} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          <SchedulePicker
            value={schedule}
            onChange={setSchedule}
            close={close}
            asapOnly={lines.some((line) => !!line.dish.deal)}
          />

          <Card style={{ gap: 10 }}>
            <SectionTitle icon="location-outline" title={t('address')} />
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder={t('addressPlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={inputStyle}
              multiline
            />
            <Button small variant="secondary" icon="map-outline" title={t('changeOnMap')} onPress={() => router.push('/location')} />
            <SectionTitle icon="document-text-outline" title={t('notes')} />
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={t('notesPlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={inputStyle}
              multiline
            />
          </Card>

          <Card style={{ gap: 10 }}>
            <SectionTitle icon="wallet-outline" title={t('payment')} />
            <View style={[styles.payOption, { borderColor: colors.primary, backgroundColor: `${colors.primary}0D` }]}>
              <Icon name="cash-outline" size={22} color={colors.text} />
              <Txt style={{ flex: 1, fontWeight: '600' }}>{t('cashOnDelivery')}</Txt>
              <Icon name="radio-button-on" size={22} color={colors.primary} />
            </View>
            <View style={[styles.payOption, { borderColor: colors.border, opacity: 0.6 }]}>
              <Icon name="card-outline" size={22} color={colors.textMuted} />
              <Txt style={{ flex: 1, fontWeight: '600' }} muted>
                {t('cardPayment')}
              </Txt>
              <View style={[styles.soonPill, { backgroundColor: colors.surfaceAlt }]}>
                <Txt variant="caption" muted style={{ fontWeight: '700' }}>
                  {t('comingSoon')}
                </Txt>
              </View>
            </View>
          </Card>

          {(availableVouchers.length > 0 || firstOrder || credit > 0) && (
            <Card style={{ gap: 10 }}>
              <SectionTitle icon="gift-outline" title={t('rewardsAndBalance')} />
              {availableVouchers.length > 0 && (
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
              )}
              {firstOrder && (
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
              )}
              {credit > 0 && (
                <View style={styles.row}>
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

          <Card style={{ gap: 10 }}>
            <SummaryRow label={t('subtotal')} value={formatPrice(subtotal)} />
            {discount > 0 && (
              <SummaryRow label={t('discount')} value={`− ${formatPrice(discount)}`} valueColor={colors.success} />
            )}
            <SummaryRow
              label={t('delivery')}
              value={deliveryFee === 0 ? t('free') : formatPrice(deliveryFee)}
              valueColor={deliveryFee === 0 ? colors.success : undefined}
              strike={deliveryFee === 0 ? formatPrice(DELIVERY_FEE) : undefined}
              onInfo={() =>
                showAlert(t('delivery'), t('deliveryInfo', { n: FREE_DELIVERY_ORDERS, amount: DELIVERY_FEE }))
              }
            />
            <SummaryRow
              label={t('serviceFee')}
              value={formatPrice(SERVICE_FEE)}
              onInfo={() => showAlert(t('serviceFee'), t('serviceFeeInfo', { amount: SERVICE_FEE }))}
            />
            {creditUsed > 0 && (
              <SummaryRow label={t('creditLine')} value={`− ${formatPrice(creditUsed)}`} valueColor={colors.success} />
            )}
          </Card>
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <View style={styles.summaryRow}>
            <Txt variant="heading">{t('grandTotal')}</Txt>
            <Txt variant="heading" style={{ fontWeight: '800' }}>
              {formatPrice(total)}
            </Txt>
          </View>
          {points > 0 && (
            <View style={[styles.row, { justifyContent: 'flex-end' }]}>
              <Icon name="gift-outline" size={15} color={colors.primary} />
              <Txt variant="caption" style={{ fontWeight: '600', color: colors.primary }}>
                {t('youWillEarn', { n: points })}
              </Txt>
            </View>
          )}
          <Button title={t('placeOrder')} onPress={submit} loading={busy} style={{ marginTop: 8 }} />
        </SafeAreaView>
      </KeyboardAvoidingView>

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
                <Icon name="gift" size={20} color={colors.primary} />
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
                router.replace('/orders');
              }}
            />
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}

function SectionTitle({ icon, title }: { icon: IconName; title: string }) {
  const { colors } = useSettings();
  return (
    <View style={styles.row}>
      <Icon name={icon} size={18} color={colors.textMuted} />
      <Txt style={{ fontWeight: '700', fontSize: 16 }}>{title}</Txt>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  valueColor,
  strike,
  onInfo,
}: {
  label: string;
  value: string;
  valueColor?: string;
  strike?: string;
  onInfo?: () => void;
}) {
  const { colors } = useSettings();
  return (
    <View style={styles.summaryRow}>
      <View style={styles.row}>
        <Txt muted>{label}</Txt>
        {onInfo && (
          <Pressable onPress={onInfo} hitSlop={10} accessibilityRole="button" accessibilityLabel={`${label} info`}>
            <Icon name="information-circle-outline" size={18} color={colors.primary} />
          </Pressable>
        )}
      </View>
      <View style={styles.row}>
        {strike && (
          <Txt muted style={{ textDecorationLine: 'line-through' }}>
            {strike}
          </Txt>
        )}
        <Txt color={valueColor} style={{ fontWeight: '600' }}>
          {value}
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { borderRadius: 14, borderWidth: 1, padding: 12, fontSize: 15, fontFamily: FONT.regular, minHeight: 48 },
  payOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1.5 },
  soonPill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 2 },
  successIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  earnedPill: { borderRadius: 16, paddingVertical: 8, paddingHorizontal: 14, marginBottom: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
});
