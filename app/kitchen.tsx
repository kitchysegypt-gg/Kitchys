import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DishEditor } from '@/components/DishEditor';
import { ChefAvatar, RatingBadge } from '@/components/media';
import { formatPortion } from '@/data/menu';
import { Button, Card, EmptyState, Icon, ScreenHeader, Txt } from '@/components/ui';
import { showAlert } from '@/lib/alert';
import { kitchenChefToChef, useCatalog } from '@/lib/catalog';
import {
  DishDraft,
  addKitchenDish,
  deleteKitchenDish,
  emptyDish,
  isDishReady,
  setDishAvailable,
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
              <ChefAvatar chef={kitchenChefToChef(kitchen)} size={56} />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="heading">{kitchen.name}</Txt>
                <Txt variant="caption" muted>
                  {kitchen.specialty} · {kitchen.area}
                </Txt>
                <RatingBadge rating={ratings[kitchen.id]} />
              </View>
            </Card>
            <Txt muted>{t('kitchenBody')}</Txt>

            {dishes.length === 0 && !draft && <Txt muted>{t('noKitchenDishes')}</Txt>}
            {dishes.map((d) => (
              <Card key={d.id} style={styles.dishRow}>
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
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dishRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
