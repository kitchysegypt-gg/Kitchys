import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { DishArt } from '@/components/media';
import { ScheduleValue, SchedulePicker } from '@/components/SchedulePicker';
import { Button, Card, EmptyState, Icon, Screen, ScreenHeader, Txt } from '@/components/ui';
import { showAlert } from '@/lib/alert';
import { DELIVERY_RADIUS_KM, useCatalog } from '@/lib/catalog';
import { FONT } from '@/lib/fonts';
import { useMembership } from '@/lib/membership';
import { useOrders } from '@/lib/orders';
import { OPEN_MINUTES, formatTime, isWithinHours, slotDate } from '@/lib/schedule';
import { useSettings } from '@/lib/settings';
import { DELIVERY_FEE, SERVICE_FEE, supabase } from '@/lib/supabase';

/**
 * Big order for a family gathering, from a kitchen that takes them: portions of each dish,
 * how many guests, and a day at least the kitchen's notice ahead. Full price, paid on delivery.
 */
export default function BigOrderScreen() {
  const { chefId } = useLocalSearchParams<{ chefId: string }>();
  const { t, l, colors, formatPrice, isRTL, location, language } = useSettings();
  const { getChef, dishesByChef, isNear, lastDelivery } = useCatalog();
  const { placeOrder, freeDeliveriesLeft } = useOrders();
  const { isMember } = useMembership();
  const chef = getChef(chefId);
  const big = chef?.bigOrders;
  const dishes = dishesByChef(chefId).filter((d) => !d.deal);

  const [portions, setPortions] = useState<Record<string, number>>({});
  const [guests, setGuests] = useState(big?.minPortions ?? 10);
  const [schedule, setSchedule] = useState<ScheduleValue>({ mode: 'asap' });
  const [typedAddress, setAddress] = useState<string | null>(null);
  const address = typedAddress ?? (location ? [location.address, location.details].filter(Boolean).join(', ') : '');
  const [typedPhone, setPhone] = useState<string | null>(null);
  const [lastPhone, setLastPhone] = useState('');
  const phone = typedPhone ?? lastPhone;
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.rpc('my_last_phone').then(({ data }) => {
      if (typeof data === 'string') setLastPhone(data);
    });
  }, []);

  if (!chef || !big)
    return (
      <Screen>
        <ScreenHeader title={t('bigOrderTitle')} />
        <EmptyState icon="people-outline" title={t('bigOrderUnavailable')} />
      </Screen>
    );

  const total = dishes.reduce((n, d) => n + (portions[d.id] ?? 0), 0);
  const food = dishes.reduce((sum, d) => sum + (portions[d.id] ?? 0) * d.price, 0);
  const deliveryFee = isMember || freeDeliveriesLeft > 0 ? 0 : DELIVERY_FEE;
  const grand = food + deliveryFee + SERVICE_FEE;
  const enough = total >= big.minPortions;

  const step = (dishId: string, by: number) =>
    setPortions((prev) => ({ ...prev, [dishId]: Math.max(0, Math.min(500, (prev[dishId] ?? 0) + by)) }));

  const send = async () => {
    if (!enough) return showAlert(t('bigOrderTitle'), t('bigOrderMin', { n: big.minPortions }));
    if (schedule.mode !== 'later') return showAlert(t('deliveryTime'), t('bigOrderNotice', { n: big.noticeDays }));
    const close = lastDelivery(chef.id);
    if (!isWithinHours(slotDate(schedule.day, schedule.minutes), close)) {
      return showAlert(t('deliveryTime'), t('kitchenHours', { from: formatTime(OPEN_MINUTES, language), to: formatTime(close, language) }));
    }
    if (!location) {
      showAlert(t('location'), t('setAddressFirst'));
      return router.push('/location');
    }
    if (!isNear(chef.id)) return showAlert(t('tooFarTitle'), t('tooFarBody', { chef: l(chef.name), km: DELIVERY_RADIUS_KM }));
    if (!address.trim()) return showAlert(t('address'), t('addressRequired'));
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    if (cleanPhone.replace(/\D/g, '').length < 8) return showAlert(t('phoneLabel'), t('phoneRequired'));
    setBusy(true);
    try {
      await placeOrder({
        items: dishes
          .filter((d) => (portions[d.id] ?? 0) > 0)
          .map((d) => ({ dishId: d.id, name: d.name.en, price: d.price, quantity: portions[d.id] })),
        subtotal: food,
        address: address.trim(),
        phone: cleanPhone,
        notes: notes.trim() || null,
        delivery_lat: location.latitude,
        delivery_lng: location.longitude,
        scheduled_for: slotDate(schedule.day, schedule.minutes).toISOString(),
        big_order: true,
        guests,
      });
      showAlert(t('bigOrderSentTitle'), t('bigOrderSentBody', { chef: l(chef.name) }));
      router.replace('/orders');
    } catch (e: any) {
      showAlert(t('error'), e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const input = [styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text, textAlign: isRTL ? 'right' : 'left' } as const];

  return (
    <Screen>
      <ScreenHeader title={t('bigOrderTitle')} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Txt muted>{t('bigOrderIntro', { chef: l(chef.name), n: big.minPortions, days: big.noticeDays })}</Txt>

          <Card style={{ gap: 12 }}>
            <Txt style={{ fontWeight: '700' }}>{t('bigOrderPortions')}</Txt>
            {dishes.map((d) => (
              <View key={d.id} style={styles.dishRow}>
                <View style={{ width: 56 }}>
                  <DishArt dish={d} height={48} radius={10} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt numberOfLines={1} style={{ fontWeight: '600' }}>
                    {l(d.name)}
                  </Txt>
                  <Txt variant="caption" muted>
                    {formatPrice(d.price)}
                  </Txt>
                </View>
                <Stepper value={portions[d.id] ?? 0} onMinus={() => step(d.id, -1)} onPlus={() => step(d.id, 1)} />
              </View>
            ))}
            <Txt variant="caption" style={{ color: enough ? colors.success : colors.textMuted, fontWeight: '700' }}>
              {t('bigOrderCount', { n: total, min: big.minPortions })}
            </Txt>
          </Card>

          <Card style={styles.dishRow}>
            <Icon name="people-outline" size={22} color={colors.primary} />
            <Txt style={{ flex: 1, fontWeight: '700' }}>{t('bigOrderGuests')}</Txt>
            <Stepper value={guests} onMinus={() => setGuests((g) => Math.max(1, g - 1))} onPlus={() => setGuests((g) => Math.min(500, g + 1))} />
          </Card>

          <SchedulePicker value={schedule} onChange={setSchedule} close={lastDelivery(chef.id)} minDay={big.noticeDays} />

          <Card style={{ gap: 10 }}>
            <Txt style={{ fontWeight: '700' }}>{t('address')}</Txt>
            <TextInput value={address} onChangeText={setAddress} placeholder={t('addressPlaceholder')} placeholderTextColor={colors.textMuted} style={input} multiline />
            <Txt style={{ fontWeight: '700' }}>{t('phoneLabel')}</Txt>
            <TextInput value={phone} onChangeText={setPhone} placeholder={t('phonePlaceholder')} placeholderTextColor={colors.textMuted} style={input} keyboardType="phone-pad" />
            <TextInput value={notes} onChangeText={setNotes} placeholder={t('bigOrderNote')} placeholderTextColor={colors.textMuted} style={input} multiline maxLength={500} />
          </Card>

          <Card style={{ gap: 6 }}>
            <Row label={t('subtotal')} value={formatPrice(food)} />
            <Row label={t('delivery')} value={deliveryFee ? formatPrice(deliveryFee) : t('free')} />
            <Row label={t('serviceFee')} value={formatPrice(SERVICE_FEE)} />
            <View style={[styles.line, { backgroundColor: colors.border }]} />
            <Row label={t('total')} value={formatPrice(grand)} bold />
            <Txt variant="caption" muted>
              {t('bigOrderPay')}
            </Txt>
          </Card>

          <Button title={t('bigOrderSend')} icon="checkmark" onPress={send} loading={busy} disabled={!enough} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );

  function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
    return (
      <View style={styles.row}>
        <Txt style={{ flex: 1, fontWeight: bold ? '800' : '400' }}>{label}</Txt>
        <Txt style={{ fontWeight: bold ? '800' : '600' }}>{value}</Txt>
      </View>
    );
  }

  function Stepper({ value, onMinus, onPlus }: { value: number; onMinus: () => void; onPlus: () => void }) {
    return (
      <View style={styles.stepper}>
        <Pressable onPress={onMinus} hitSlop={8} accessibilityLabel="-">
          <Icon name="remove-circle" size={32} color={value > 0 ? colors.primary : colors.border} />
        </Pressable>
        <Txt style={{ minWidth: 34, textAlign: 'center', fontWeight: '800', fontSize: 17 }}>{value}</Txt>
        <Pressable onPress={onPlus} hitSlop={8} accessibilityLabel="+">
          <Icon name="add-circle" size={32} color={colors.primary} />
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  dishRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center' },
  line: { height: 1, marginVertical: 4 },
  input: { borderRadius: 14, borderWidth: 1, padding: 12, fontSize: 15, fontFamily: FONT.regular },
});
