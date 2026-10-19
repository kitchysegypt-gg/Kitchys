import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Coordinate } from '@/components/DeliveryMap';
import { KitchenLocationPicker } from '@/components/KitchenLocationPicker';
import { LastDeliveryCard } from '@/components/LastDeliveryCard';
import { pickImage } from '@/components/PhotoPicker';
import { ChefAvatar, RatingBadge } from '@/components/media';
import { Button, Card, Icon, IconBadge, ScreenHeader, Txt } from '@/components/ui';
import { showAlert } from '@/lib/alert';
import { DELIVERY_RADIUS_KM, kitchenChefToChef, useCatalog } from '@/lib/catalog';
import { fetchKitchenLocation, setKitchenLocation, setKitchenPhoto } from '@/lib/chef';
import { leaveKitchen, useKitchen } from '@/lib/kitchen';
import { useSettings } from '@/lib/settings';
import { supabase } from '@/lib/supabase';

/** Kitchen > Settings: photo, taking orders on/off, location and last delivery time. */
export default function KitchenSettingsScreen() {
  const { t, colors } = useSettings();
  const { kitchen, reload, paused, setPaused } = useKitchen();
  const { ratings, refresh } = useCatalog();
  const [photoBusy, setPhotoBusy] = useState(false);
  const [pauseBusy, setPauseBusy] = useState(false);
  // The saved kitchen location, and the one being picked on the map.
  const [savedSpot, setSavedSpot] = useState<Coordinate | null | undefined>(undefined);
  const [spot, setSpot] = useState<Coordinate | null>(null);
  const [spotBusy, setSpotBusy] = useState(false);

  const kitchenId = kitchen?.id;
  useEffect(() => {
    if (!kitchenId) return;
    let cancelled = false;
    fetchKitchenLocation()
      .catch(() => null)
      .then((found) => {
        if (cancelled) return;
        setSavedSpot(found);
        setSpot(found);
      });
    return () => {
      cancelled = true;
    };
  }, [kitchenId]);

  if (!kitchen) return null;

  const spotChanged =
    !!spot && (!savedSpot || spot.latitude !== savedSpot.latitude || spot.longitude !== savedSpot.longitude);

  const saveSpot = async () => {
    if (!spot) return;
    setSpotBusy(true);
    try {
      await setKitchenLocation(spot);
      setSavedSpot(spot);
      await refresh();
      showAlert(t('kitchenLocationSaved'), t('kitchenLocationIsSet', { km: DELIVERY_RADIUS_KM }));
    } catch (e: any) {
      showAlert(t('error'), e?.message ?? String(e));
    } finally {
      setSpotBusy(false);
    }
  };

  const changePhoto = async () => {
    try {
      const uri = await pickImage([1, 1]);
      if (!uri) return;
      setPhotoBusy(true);
      await setKitchenPhoto(uri);
      await reload();
      await refresh();
      showAlert(t('photoUpdated'));
    } catch (e: any) {
      showAlert(t('error'), e?.message ?? String(e));
    } finally {
      setPhotoBusy(false);
    }
  };

  const togglePaused = async (next: boolean) => {
    setPauseBusy(true);
    try {
      await setPaused(next);
    } catch (e: any) {
      showAlert(t('error'), e?.message ?? String(e));
    } finally {
      setPauseBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView edges={['top']}>
        <ScreenHeader title={t('kitchenSettings')} onBack={leaveKitchen} />
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 12, paddingBottom: 40 }}>
        <Card style={styles.hero}>
          <Pressable
            onPress={changePhoto}
            disabled={photoBusy}
            accessibilityRole="button"
            accessibilityLabel={t('changePhoto')}>
            <ChefAvatar chef={kitchenChefToChef(kitchen)} size={72} />
            <View style={[styles.cameraBadge, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
              {photoBusy ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <Icon name="camera" size={14} color={colors.onPrimary} />
              )}
            </View>
          </Pressable>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="heading">{kitchen.name}</Txt>
            <Txt variant="caption" muted>
              {kitchen.specialty} · {kitchen.area}
            </Txt>
            <RatingBadge rating={ratings[kitchen.id]} />
          </View>
        </Card>

        <Card style={styles.row}>
          <IconBadge name={paused ? 'pause-circle-outline' : 'power-outline'} tone={paused ? 'pink' : 'green'} size={40} solid />
          <View style={{ flex: 1 }}>
            <Txt style={{ fontWeight: '700' }}>{paused ? t('kitchenPaused') : t('kitchenTakingOrders')}</Txt>
            <Txt variant="caption" muted>
              {paused ? t('kitchenPausedBody') : t('kitchenTakingOrdersBody')}
            </Txt>
          </View>
          <Switch
            value={!paused}
            disabled={pauseBusy}
            onValueChange={(on) => togglePaused(!on)}
            trackColor={{ true: colors.success }}
            accessibilityLabel={t('kitchenTakingOrders')}
          />
        </Card>

        <Pressable onPress={() => router.push('/kitchen/premium')} accessibilityRole="button">
          <Card style={styles.row}>
            <IconBadge name="diamond-outline" tone="amber" size={40} solid />
            <View style={{ flex: 1 }}>
              <Txt style={{ fontWeight: '700' }}>{t('premiumCardTitle')}</Txt>
              <Txt variant="caption" muted>
                {t('premiumCardBody')}
              </Txt>
            </View>
            <Icon name="chevron-forward" size={20} color={colors.textMuted} />
          </Card>
        </Pressable>

        <LastDeliveryCard chefId={kitchen.id} />

        <BigOrdersCard
          on={!!kitchen.big_orders}
          min={kitchen.big_min_portions ?? 10}
          days={kitchen.big_notice_days ?? 2}
          onSaved={async () => {
            await reload();
            await refresh();
          }}
        />

        {savedSpot === null && (
          <View style={[styles.notice, { backgroundColor: colors.surfaceAlt }]}>
            <Icon name="warning-outline" size={20} color={colors.danger} />
            <Txt variant="caption" style={{ flex: 1, fontWeight: '600' }}>
              {t('kitchenLocationMissing')}
            </Txt>
          </View>
        )}
        {savedSpot !== undefined && (
          <KitchenLocationPicker value={spot} onChange={setSpot}>
            {spotChanged && (
              <Button title={t('saveKitchenLocation')} icon="checkmark" onPress={saveSpot} loading={spotBusy} />
            )}
          </KitchenLocationPicker>
        )}

        <Button
          title={t('helpKitchenLink')}
          icon="help-circle-outline"
          variant="secondary"
          onPress={() => router.push({ pathname: '/help', params: { for: 'chef' } })}
        />
        <Button title={t('backToCustomerApp')} icon="arrow-back" variant="secondary" onPress={leaveKitchen} />
      </ScrollView>
    </View>
  );
}

/** Big orders for family gatherings: off by default, the chef sets the smallest order and how many days ahead. */
function BigOrdersCard({ on, min, days, onSaved }: { on: boolean; min: number; days: number; onSaved: () => Promise<void> }) {
  const { t, colors } = useSettings();
  const [draft, setDraft] = useState({ on, min, days });
  const [busy, setBusy] = useState(false);
  const changed = draft.on !== on || draft.min !== min || draft.days !== days;

  const save = async (next = draft) => {
    setBusy(true);
    try {
      const { error } = await supabase.rpc('set_big_orders', { p_on: next.on, p_min: next.min, p_days: next.days });
      if (error) throw error;
      await onSaved();
    } catch (e: any) {
      setDraft({ on, min, days });
      showAlert(t('error'), e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ gap: 12 }}>
      <View style={styles.row}>
        <IconBadge name="people-outline" tone="orange" size={40} solid />
        <View style={{ flex: 1 }}>
          <Txt style={{ fontWeight: '700' }}>{t('bigOrdersKitchen')}</Txt>
          <Txt variant="caption" muted>
            {t('bigOrdersKitchenBody')}
          </Txt>
        </View>
        <Switch
          value={draft.on}
          disabled={busy}
          onValueChange={(next) => {
            const value = { ...draft, on: next };
            setDraft(value);
            // Turning it on or off saves at once; the numbers wait for the Save button.
            save(value);
          }}
          trackColor={{ true: colors.success }}
          accessibilityLabel={t('bigOrdersKitchen')}
        />
      </View>
      {draft.on && (
        <>
          <NumberRow
            label={t('bigOrdersMinLabel')}
            value={draft.min}
            onChange={(n) => setDraft((d) => ({ ...d, min: Math.max(5, Math.min(200, n)) }))}
            step={5}
          />
          <NumberRow
            label={t('bigOrdersDaysLabel')}
            value={draft.days}
            onChange={(n) => setDraft((d) => ({ ...d, days: Math.max(1, Math.min(7, n)) }))}
            step={1}
          />
          {changed && <Button title={t('bigOrdersSave')} icon="checkmark" onPress={() => save()} loading={busy} />}
        </>
      )}
    </Card>
  );
}

function NumberRow({ label, value, onChange, step }: { label: string; value: number; onChange: (n: number) => void; step: number }) {
  const { colors } = useSettings();
  return (
    <View style={styles.row}>
      <Txt style={{ flex: 1, fontWeight: '600' }}>{label}</Txt>
      <Pressable onPress={() => onChange(value - step)} hitSlop={8} accessibilityLabel="-">
        <Icon name="remove-circle" size={32} color={colors.primary} />
      </Pressable>
      <Txt style={{ minWidth: 34, textAlign: 'center', fontWeight: '800', fontSize: 17 }}>{value}</Txt>
      <Pressable onPress={() => onChange(value + step)} hitSlop={8} accessibilityLabel="+">
        <Icon name="add-circle" size={32} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14 },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    end: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
