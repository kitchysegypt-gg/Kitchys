import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Coordinate } from '@/components/DeliveryMap';
import { DishEditor } from '@/components/DishEditor';
import { KitchenLocationPicker } from '@/components/KitchenLocationPicker';
import { LastDeliveryCard } from '@/components/LastDeliveryCard';
import { PhotoStrip, pickImage } from '@/components/PhotoPicker';
import { ChefAvatar, DishArt, RatingBadge } from '@/components/media';
import { formatPortion } from '@/data/menu';
import { Button, Card, EmptyState, Icon, ScreenHeader, Txt } from '@/components/ui';
import { showAlert } from '@/lib/alert';
import { DELIVERY_RADIUS_KM, kitchenChefToChef, kitchenDishToDish, useCatalog } from '@/lib/catalog';
import {
  DishDraft,
  addKitchenDish,
  deleteKitchenDish,
  emptyDish,
  fetchKitchenLocation,
  isDishReady,
  setDishAvailable,
  setDishPhotos,
  MAX_DISH_PHOTOS,
  setKitchenLocation,
  setKitchenPhoto,
  useChefStatus,
} from '@/lib/chef';
import { useSettings } from '@/lib/settings';

/** For approved home chefs: their live dishes, plus adding new ones. */
export default function KitchenScreen() {
  const { t, colors, formatPrice } = useSettings();
  const { kitchen, dishes, loading, reload } = useChefStatus();
  const { ratings, refresh } = useCatalog();
  const [draft, setDraft] = useState<DishDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  // The saved kitchen location, and the one being picked on the map.
  const [savedSpot, setSavedSpot] = useState<Coordinate | null | undefined>(undefined);
  const [spot, setSpot] = useState<Coordinate | null>(null);
  const [spotBusy, setSpotBusy] = useState(false);

  const loadSpot = useCallback(async () => {
    try {
      const found = await fetchKitchenLocation();
      setSavedSpot(found);
      setSpot(found);
    } catch {
      setSavedSpot(null);
    }
  }, []);

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

  const spotChanged =
    !!spot && (!savedSpot || spot.latitude !== savedSpot.latitude || spot.longitude !== savedSpot.longitude);

  const saveSpot = async () => {
    if (!spot) return;
    setSpotBusy(true);
    try {
      await setKitchenLocation(spot);
      await loadSpot();
      await refresh();
      showAlert(t('kitchenLocationSaved'), t('kitchenLocationIsSet', { km: DELIVERY_RADIUS_KM }));
    } catch (e: any) {
      showAlert(t('error'), e?.message ?? String(e));
    } finally {
      setSpotBusy(false);
    }
  };

  // The dish whose photos are open for editing.
  const [editingPhotos, setEditingPhotos] = useState<string | null>(null);
  const [dishPhotosBusy, setDishPhotosBusy] = useState(false);

  const saveDishPhotos = async (dishId: string, photos: string[]) => {
    setDishPhotosBusy(true);
    try {
      await setDishPhotos(dishId, photos);
      await afterChange();
    } catch (e: any) {
      showAlert(t('error'), e?.message ?? String(e));
    } finally {
      setDishPhotosBusy(false);
    }
  };

  const changePhoto = async () => {
    try {
      const uri = await pickImage([1, 1]);
      if (!uri) return;
      setPhotoBusy(true);
      await setKitchenPhoto(uri);
      await afterChange();
      showAlert(t('photoUpdated'));
    } catch (e: any) {
      showAlert(t('error'), e?.message ?? String(e));
    } finally {
      setPhotoBusy(false);
    }
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const afterChange = async () => {
    await reload();
    await refresh();
  };

  const save = async () => {
    if (!kitchen || !draft) return;
    if (!isDishReady(draft)) return showAlert(t('addDish'), t('fillDish'));
    setBusy(true);
    try {
      await addKitchenDish(kitchen.id, draft);
      setDraft(null);
      await afterChange();
    } catch (e: any) {
      showAlert(t('error'), e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const run = async (action: () => Promise<void>) => {
    try {
      await action();
      await afterChange();
    } catch (e: any) {
      showAlert(t('error'), e?.message ?? String(e));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView edges={['top']}>
        <ScreenHeader title={t('myKitchen')} onBack={close} />
      </SafeAreaView>

      {!kitchen ? (
        loading ? null : (
          <EmptyState icon="hourglass-outline" title={t('applicationPending')} body={t('applicationSentBody')} />
        )
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 12, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled">
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
                <Pressable onPress={changePhoto} disabled={photoBusy} hitSlop={6}>
                  <Txt variant="caption" style={{ color: colors.primary, fontWeight: '600', marginTop: 2 }}>
                    {t('changePhoto')}
                  </Txt>
                </Pressable>
              </View>
            </Card>

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

            <LastDeliveryCard chefId={kitchen.id} />

            <Txt muted>{t('kitchenBody')}</Txt>

            {dishes.length === 0 && !draft && <Txt muted>{t('noKitchenDishes')}</Txt>}
            {dishes.map((d) => (
              <View key={d.id} style={{ gap: 6 }}>
                <Card style={styles.dishRow}>
                  <Pressable
                    onPress={() => setEditingPhotos((open) => (open === d.id ? null : d.id))}
                    accessibilityRole="button"
                    accessibilityLabel={t('editPhotos')}
                    style={{ width: 72 }}>
                    <DishArt dish={kitchenDishToDish(d)} height={56} radius={12} />
                    <View style={[styles.dishCamera, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
                      <Icon name="camera" size={11} color={colors.onPrimary} />
                    </View>
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Txt style={{ fontWeight: '700' }}>{d.name}</Txt>
                    <Txt variant="caption" style={{ fontWeight: '600' }}>
                      {formatPrice(Number(d.price))}
                      {d.portion_grams ? ` · ${formatPortion(d.portion_grams)}` : ''}
                    </Txt>
                    <Txt variant="caption" muted>
                      {d.available ? t('available') : t('hidden')}
                    </Txt>
                  </View>
                  <Switch
                    value={d.available}
                    onValueChange={(v) => run(() => setDishAvailable(d.id, v))}
                    trackColor={{ true: colors.primary }}
                  />
                  <Pressable onPress={() => run(() => deleteKitchenDish(d.id))} hitSlop={8}>
                    <Icon name="trash-outline" size={22} color={colors.danger} />
                  </Pressable>
                </Card>
                {editingPhotos === d.id && (
                  <Card>
                    <PhotoStrip
                      value={d.photo_urls?.length ? d.photo_urls : d.photo_url ? [d.photo_url] : []}
                      onChange={(photos) => saveDishPhotos(d.id, photos)}
                      max={MAX_DISH_PHOTOS}
                      busy={dishPhotosBusy}
                    />
                  </Card>
                )}
              </View>
            ))}

            {draft ? (
              <>
                <DishEditor title={t('addDish')} value={draft} onChange={setDraft} onRemove={() => setDraft(null)} />
                <Button title={t('saveDish')} icon="checkmark" onPress={save} loading={busy} />
              </>
            ) : (
              <Button title={t('addDish')} icon="add" onPress={() => setDraft(emptyDish())} />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14 },
  dishCamera: {
    position: 'absolute',
    bottom: -4,
    end: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dishRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
