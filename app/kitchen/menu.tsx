import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DealPanel } from '@/components/DealPanel';
import { DishEditor } from '@/components/DishEditor';
import { PhotoStrip } from '@/components/PhotoPicker';
import { DishArt } from '@/components/media';
import { Button, Card, Icon, IconBadge, ScreenHeader, Txt } from '@/components/ui';
import { formatPortion } from '@/data/menu';
import { showAlert, showConfirm } from '@/lib/alert';
import { kitchenDishToDish, useCatalog } from '@/lib/catalog';
import {
  DishDraft,
  MAX_DISH_PHOTOS,
  addKitchenDish,
  deleteKitchenDish,
  emptyDish,
  isDishReady,
  setDishAvailable,
  setDishPhotos,
} from '@/lib/chef';
import { leaveKitchen, useKitchen } from '@/lib/kitchen';
import { useSettings } from '@/lib/settings';

/** Daily portion limits a chef can step through; null means no limit. */
const LIMIT_STEPS = [null, 3, 5, 8, 10, 15, 20, 30, 50];

/** Kitchen > Menu: the chef's dishes, their photos, availability and daily limits. */
export default function KitchenMenuScreen() {
  const { t, colors, formatPrice } = useSettings();
  const { kitchen, dishes, reload, setDailyLimit, deals, startDeal, endDeal } = useKitchen();
  const { refresh } = useCatalog();
  const [draft, setDraft] = useState<DishDraft | null>(null);
  const [busy, setBusy] = useState(false);
  // The dish whose photos are open for editing.
  const [editingPhotos, setEditingPhotos] = useState<string | null>(null);
  const [dishPhotosBusy, setDishPhotosBusy] = useState(false);

  const afterChange = async () => {
    await reload();
    await refresh();
  };

  const run = async (action: () => Promise<void>) => {
    try {
      await action();
      await afterChange();
    } catch (e: any) {
      showAlert(t('error'), e?.message ?? String(e));
    }
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

  const stepLimit = (dishId: string, current: number | null, direction: 1 | -1) => {
    const i = Math.max(0, LIMIT_STEPS.indexOf(current));
    const next = LIMIT_STEPS[Math.min(LIMIT_STEPS.length - 1, Math.max(0, i + direction))];
    if (next !== current) run(() => setDailyLimit(dishId, next));
  };

  const remove = (dishId: string, name: string) =>
    showConfirm(t('deleteDishTitle'), t('deleteDishBody', { dish: name }), {
      label: t('delete'),
      cancelLabel: t('cancel'),
      onConfirm: () => run(() => deleteKitchenDish(dishId)),
    });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView edges={['top']}>
        <ScreenHeader title={t('kitchenMenu')} onBack={leaveKitchen} />
      </SafeAreaView>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 12, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled">
          <Txt muted>{t('kitchenBody')}</Txt>

          {dishes.length === 0 && !draft && <Txt muted>{t('noKitchenDishes')}</Txt>}
          {dishes.map((d) => (
            <View key={d.id} style={{ gap: 6 }}>
              <Card style={{ gap: 12 }}>
                <View style={styles.dishRow}>
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
                    accessibilityLabel={t('available')}
                  />
                  <Pressable
                    onPress={() => remove(d.id, d.name)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('delete')}>
                    <View style={[styles.trash, { backgroundColor: `${colors.danger}14` }]}>
                      <Icon name="trash" size={18} color={colors.danger} />
                    </View>
                  </Pressable>
                </View>

                <View style={[styles.limitRow, { borderColor: colors.border }]}>
                  <IconBadge name="speedometer-outline" tone="amber" size={32} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="caption" style={{ fontWeight: '700' }}>
                      {t('dailyLimit')}
                    </Txt>
                    <Txt variant="caption" muted>
                      {d.daily_limit ? t('dailyLimitOn', { n: d.daily_limit }) : t('dailyLimitOff')}
                    </Txt>
                  </View>
                  <Pressable
                    onPress={() => stepLimit(d.id, d.daily_limit ?? null, -1)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('fewer')}>
                    <Icon name="remove-circle" size={30} color={colors.primary} />
                  </Pressable>
                  <Txt style={{ minWidth: 36, textAlign: 'center', fontWeight: '800' }}>
                    {d.daily_limit ?? '∞'}
                  </Txt>
                  <Pressable
                    onPress={() => stepLimit(d.id, d.daily_limit ?? null, 1)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('more')}>
                    <Icon name="add-circle" size={30} color={colors.primary} />
                  </Pressable>
                </View>

                {d.available && (
                  <DealPanel
                    dishId={d.id}
                    price={Number(d.price)}
                    deal={deals.find((deal) => deal.dish_id === d.id)}
                    onStart={startDeal}
                    onEnd={endDeal}
                  />
                )}
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
    </View>
  );
}

const styles = StyleSheet.create({
  dishRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
  trash: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  limitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, paddingTop: 10 },
});
