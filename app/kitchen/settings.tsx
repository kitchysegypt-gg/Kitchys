import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Coordinate } from '@/components/DeliveryMap';
import { KitchenLocationPicker } from '@/components/KitchenLocationPicker';
import { LastDeliveryCard } from '@/components/LastDeliveryCard';
import { pickImage } from '@/components/PhotoPicker';
import { ChefAvatar, RatingBadge } from '@/components/media';
import { Button, Card, Icon, ScreenHeader, Txt } from '@/components/ui';
import { showAlert } from '@/lib/alert';
import { DELIVERY_RADIUS_KM, kitchenChefToChef, useCatalog } from '@/lib/catalog';
import { fetchKitchenLocation, setKitchenLocation, setKitchenPhoto } from '@/lib/chef';
import { leaveKitchen, useKitchen } from '@/lib/kitchen';
import { useSettings } from '@/lib/settings';

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
          <View style={[styles.dot, { backgroundColor: paused ? colors.danger : colors.success }]} />
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

        <LastDeliveryCard chefId={kitchen.id} />

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

        <Button title={t('backToCustomerApp')} icon="arrow-back" variant="secondary" onPress={leaveKitchen} />
      </ScrollView>
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
