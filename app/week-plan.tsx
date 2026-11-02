import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DishArt } from '@/components/media';
import { Button, Card, Chip, Icon, Screen, ScreenHeader, Txt } from '@/components/ui';
import type { Dish } from '@/data/menu';
import { showAlert } from '@/lib/alert';
import { useAuth } from '@/lib/auth';
import { DELIVERY_RADIUS_KM, useCatalog } from '@/lib/catalog';
import { useFavorites } from '@/lib/favorites';
import { FONT } from '@/lib/fonts';
import { useMembership } from '@/lib/membership';
import { useOrders } from '@/lib/orders';
import { formatDay, formatTime, isWithinHours, slotDate, startOfDay } from '@/lib/schedule';
import { useSettings } from '@/lib/settings';
import { DELIVERY_FEE, SERVICE_FEE, supabase } from '@/lib/supabase';

/** The plan covers tomorrow and the six days after it. */
const DAYS = [1, 2, 3, 4, 5, 6, 7];
const TIMES = [18 * 60, 18 * 60 + 30, 19 * 60, 19 * 60 + 30, 20 * 60, 20 * 60 + 30];

type Pick = { dishId: string; quantity: number };
/** Saved on the phone by weekday (0 = Sunday), so "Same as last week" fills the same dinners. */
type SavedPlan = { minutes: number; byWeekday: Record<number, Pick> };

const weekdayOf = (day: number) => startOfDay(day).getDay();

/**
 * Weekly dinner plan: pick a dinner for each day of the coming week (favourites first), one
 * delivery time, and place it in one go. Each day becomes its own scheduled order.
 */
export default function WeekPlanScreen() {
  const { t, l, colors, formatPrice, isRTL, location, language } = useSettings();
  const { session } = useAuth();
  const { dishes, getDish, getChef, isNear, isPaused, lastDelivery } = useCatalog();
  const { ids: favoriteIds } = useFavorites();
  const { placeOrder, freeDeliveriesLeft } = useOrders();
  const { isMember } = useMembership();
  const storageKey = `weekPlan:${session?.user.id ?? ''}`;

  const [plan, setPlan] = useState<Record<number, Pick>>({});
  const [minutes, setMinutes] = useState(19 * 60);
  const [saved, setSaved] = useState<SavedPlan | null>(null);
  const [choosingDay, setChoosingDay] = useState<number | null>(null);
  const [typedAddress, setAddress] = useState<string | null>(null);
  const address = typedAddress ?? (location ? [location.address, location.details].filter(Boolean).join(', ') : '');
  const [typedPhone, setPhone] = useState<string | null>(null);
  const [lastPhone, setLastPhone] = useState('');
  const phone = typedPhone ?? lastPhone;
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.rpc('my_last_phone').then(({ data }) => {
      if (typeof data === 'string') setLastPhone(data);
    });
    AsyncStorage.getItem(storageKey)
      .then((raw) => setSaved(raw ? (JSON.parse(raw) as SavedPlan) : null))
      .catch(() => setSaved(null));
  }, [storageKey]);

  // Dinners that can be booked ahead: near the customer, kitchen open for orders, not a same-day deal.
  const choices = useMemo(() => {
    const ok = dishes.filter((d) => !d.deal && isNear(d.chefId) && !isPaused(d.chefId));
    const favourites = ok.filter((d) => favoriteIds.has(d.id));
    return { favourites, others: ok.filter((d) => !favoriteIds.has(d.id)) };
  }, [dishes, favoriteIds, isNear, isPaused]);

  const days = DAYS.filter((day) => plan[day] && getDish(plan[day].dishId));
  const freeLeft = isMember ? Infinity : freeDeliveriesLeft;
  const total = days.reduce((sum, day, i) => {
    const dish = getDish(plan[day].dishId)!;
    return sum + dish.price * plan[day].quantity + (i < freeLeft ? 0 : DELIVERY_FEE) + SERVICE_FEE;
  }, 0);

  const repeatLast = () => {
    if (!saved) return;
    const next: Record<number, Pick> = {};
    for (const day of DAYS) {
      const pick = saved.byWeekday[weekdayOf(day)];
      const dish = pick && getDish(pick.dishId);
      if (dish && !dish.deal) next[day] = pick;
    }
    setPlan(next);
    setMinutes(saved.minutes);
  };

  const choose = (dish: Dish) => {
    if (choosingDay === null) return;
    setPlan((prev) => ({ ...prev, [choosingDay]: { dishId: dish.id, quantity: prev[choosingDay]?.quantity ?? 1 } }));
    setChoosingDay(null);
  };

  const setQuantity = (day: number, by: number) =>
    setPlan((prev) => {
      const pick = prev[day];
      if (!pick) return prev;
      return { ...prev, [day]: { ...pick, quantity: Math.max(1, Math.min(20, pick.quantity + by)) } };
    });

  const remove = (day: number) =>
    setPlan((prev) => {
      const next = { ...prev };
      delete next[day];
      return next;
    });

  const dayLabel = (day: number) => formatDay(day, language, { today: t('today'), tomorrow: t('tomorrow') });

  const placePlan = async () => {
    if (days.length === 0) return showAlert(t('weekPlanTitle'), t('weekPlanEmpty'));
    if (!location) {
      showAlert(t('location'), t('setAddressFirst'));
      return router.push('/location');
    }
    if (!address.trim()) return showAlert(t('address'), t('addressRequired'));
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    if (cleanPhone.replace(/\D/g, '').length < 8) return showAlert(t('phoneLabel'), t('phoneRequired'));
    for (const day of days) {
      const dish = getDish(plan[day].dishId)!;
      const chef = getChef(dish.chefId);
      if (!isNear(dish.chefId)) {
        return showAlert(t('tooFarTitle'), t('tooFarBody', { chef: chef ? l(chef.name) : '', km: DELIVERY_RADIUS_KM }));
      }
      const close = lastDelivery(dish.chefId);
      if (!isWithinHours(slotDate(day, minutes), close)) {
        return showAlert(
          dayLabel(day),
          t('weekPlanTooLate', { chef: chef ? l(chef.name) : '', time: formatTime(close, language) })
        );
      }
    }

    setBusy(true);
    const failed: string[] = [];
    for (const day of days) {
      const pick = plan[day];
      const dish = getDish(pick.dishId)!;
      try {
        await placeOrder({
          items: [{ dishId: dish.id, name: dish.name.en, price: dish.price, quantity: pick.quantity }],
          subtotal: dish.price * pick.quantity,
          address: address.trim(),
          phone: cleanPhone,
          notes: null,
          delivery_lat: location.latitude,
          delivery_lng: location.longitude,
          scheduled_for: slotDate(day, minutes).toISOString(),
        });
      } catch (e: any) {
        failed.push(`${dayLabel(day)}: ${e?.message ?? String(e)}`);
      }
    }
    setBusy(false);

    const byWeekday: Record<number, Pick> = {};
    for (const day of days) byWeekday[weekdayOf(day)] = plan[day];
    AsyncStorage.setItem(storageKey, JSON.stringify({ minutes, byWeekday } satisfies SavedPlan)).catch(() => {});

    if (failed.length === days.length) return showAlert(t('error'), failed.join('\n'));
    if (failed.length) showAlert(t('weekPlanPartTitle'), t('weekPlanPartBody', { list: failed.join('\n') }));
    else showAlert(t('weekPlanDoneTitle'), t('weekPlanDoneBody', { n: days.length }));
    router.replace('/orders');
  };

  const input = [styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text, textAlign: isRTL ? 'right' : 'left' } as const];

  return (
    <Screen>
      <ScreenHeader title={t('weekPlanTitle')} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Txt muted>{t('weekPlanIntro')}</Txt>

          {saved && days.length === 0 && (
            <Button title={t('weekPlanRepeat')} icon="refresh" variant="secondary" onPress={repeatLast} />
          )}

          <Card style={{ gap: 10 }}>
            <Txt style={{ fontWeight: '700' }}>{t('weekPlanTime')}</Txt>
            <View style={styles.chips}>
              {TIMES.map((m) => (
                <Chip key={m} label={formatTime(m, language)} active={minutes === m} onPress={() => setMinutes(m)} />
              ))}
            </View>
          </Card>

          {DAYS.map((day) => {
            const pick = plan[day];
            const dish = pick && getDish(pick.dishId);
            const chef = dish && getChef(dish.chefId);
            return (
              <Card key={day} style={{ gap: 10 }}>
                <Txt style={{ fontWeight: '800' }}>{dayLabel(day)}</Txt>
                {dish ? (
                  <View style={styles.row}>
                    <Pressable onPress={() => setChoosingDay(day)} style={[styles.row, { flex: 1 }]} accessibilityRole="button">
                      <View style={{ width: 56 }}>
                        <DishArt dish={dish} height={48} radius={10} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Txt numberOfLines={1} style={{ fontWeight: '600' }}>
                          {l(dish.name)}
                        </Txt>
                        <Txt variant="caption" muted numberOfLines={1}>
                          {chef ? l(chef.name) : ''} · {formatPrice(dish.price)}
                        </Txt>
                      </View>
                    </Pressable>
                    <Pressable onPress={() => setQuantity(day, -1)} hitSlop={8} accessibilityLabel="-">
                      <Icon name="remove-circle" size={30} color={pick.quantity > 1 ? colors.primary : colors.border} />
                    </Pressable>
                    <Txt style={{ minWidth: 24, textAlign: 'center', fontWeight: '800', fontSize: 16 }}>{pick.quantity}</Txt>
                    <Pressable onPress={() => setQuantity(day, 1)} hitSlop={8} accessibilityLabel="+">
                      <Icon name="add-circle" size={30} color={colors.primary} />
                    </Pressable>
                    <Pressable onPress={() => remove(day)} hitSlop={8} accessibilityLabel={t('weekPlanSkip')}>
                      <Icon name="close" size={22} color={colors.textMuted} />
                    </Pressable>
                  </View>
                ) : (
                  <Button small variant="secondary" icon="add" title={t('weekPlanChoose')} onPress={() => setChoosingDay(day)} />
                )}
              </Card>
            );
          })}

          <Card style={{ gap: 10 }}>
            <Txt style={{ fontWeight: '700' }}>{t('address')}</Txt>
            <TextInput value={address} onChangeText={setAddress} placeholder={t('addressPlaceholder')} placeholderTextColor={colors.textMuted} style={input} multiline />
            <Txt style={{ fontWeight: '700' }}>{t('phoneLabel')}</Txt>
            <TextInput
              value={phone}
              onChangeText={(v) => setPhone(v.replace(/[^0-9+ ]/g, ''))}
              placeholder={t('phonePlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={input}
              keyboardType="phone-pad"
              maxLength={20}
            />
          </Card>

          {days.length > 0 && (
            <Card style={{ gap: 6 }}>
              <View style={styles.row}>
                <Txt style={{ flex: 1, fontWeight: '800' }}>{t('weekPlanSummary', { n: days.length })}</Txt>
                <Txt style={{ fontWeight: '800' }}>{formatPrice(total)}</Txt>
              </View>
              <Txt variant="caption" muted>
                {t('weekPlanPay')}
              </Txt>
            </Card>
          )}

          <Button title={t('weekPlanPlace')} icon="checkmark" onPress={placePlan} loading={busy} disabled={days.length === 0} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={choosingDay !== null} animationType="slide" onRequestClose={() => setChoosingDay(null)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <SafeAreaView edges={['top']}>
            <View style={[styles.row, { padding: 16 }]}>
              <Txt variant="heading" style={{ flex: 1 }}>
                {choosingDay !== null ? dayLabel(choosingDay) : ''}
              </Txt>
              <Pressable onPress={() => setChoosingDay(null)} hitSlop={10} accessibilityLabel={t('cancel')}>
                <Icon name="close" size={26} />
              </Pressable>
            </View>
          </SafeAreaView>
          <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 10, paddingBottom: 40 }}>
            {choices.favourites.length > 0 && <Txt style={{ fontWeight: '700' }}>{t('favoritesTitle')}</Txt>}
            {choices.favourites.map((d) => (
              <ChoiceRow key={d.id} dish={d} onPress={() => choose(d)} />
            ))}
            {choices.others.length > 0 && <Txt style={{ fontWeight: '700', marginTop: 6 }}>{t('weekPlanAllDinners')}</Txt>}
            {choices.others.map((d) => (
              <ChoiceRow key={d.id} dish={d} onPress={() => choose(d)} />
            ))}
            {choices.favourites.length + choices.others.length === 0 && <Txt muted>{t('weekPlanNoDishes')}</Txt>}
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}

function ChoiceRow({ dish, onPress }: { dish: Dish; onPress: () => void }) {
  const { l, formatPrice } = useSettings();
  const { getChef } = useCatalog();
  const chef = getChef(dish.chefId);
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card style={styles.row}>
        <View style={{ width: 64 }}>
          <DishArt dish={dish} height={54} radius={10} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt numberOfLines={1} style={{ fontWeight: '600' }}>
            {l(dish.name)}
          </Txt>
          <Txt variant="caption" muted numberOfLines={1}>
            {chef ? l(chef.name) : ''}
          </Txt>
        </View>
        <Txt style={{ fontWeight: '700' }}>{formatPrice(dish.price)}</Txt>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { borderRadius: 14, borderWidth: 1, padding: 12, fontSize: 15, fontFamily: FONT.regular, minHeight: 48 },
});
