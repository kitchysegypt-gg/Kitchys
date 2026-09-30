import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DishEditor } from '@/components/DishEditor';
import { Emoji3D } from '@/components/Emoji3D';
import { RatingBadge } from '@/components/media';
import { Button3D, Card3D, EmptyState, Txt } from '@/components/ui';
import { showAlert } from '@/lib/alert';
import { useCatalog } from '@/lib/catalog';
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
      <SafeAreaView edges={['top']} style={styles.header}>
        <Pressable onPress={close} hitSlop={10} style={[styles.close, { backgroundColor: colors.surface }]}>
          <Emoji3D name="cross_mark" size={20} />
        </Pressable>
        <Txt variant="heading">{t('myKitchen')}</Txt>
      </SafeAreaView>

      {!kitchen ? (
        loading ? null : (
          <EmptyState emoji="locked" title={t('applicationPending')} body={t('applicationSentBody')} />
        )
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled">
            <Card3D style={styles.hero}>
              <Emoji3D name="cooking" size={56} float />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="heading">{kitchen.name}</Txt>
                <Txt variant="caption" muted>
                  {kitchen.specialty} · {kitchen.area}
                </Txt>
                <RatingBadge rating={ratings[kitchen.id]} />
              </View>
            </Card3D>
            <Txt muted>{t('kitchenBody')}</Txt>

            {dishes.length === 0 && !draft && <Txt muted>{t('noKitchenDishes')}</Txt>}
            {dishes.map((d) => (
              <Card3D key={d.id} style={styles.dishRow}>
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontWeight: '800' }}>{d.name}</Txt>
                  <Txt variant="caption" style={{ color: colors.primary, fontWeight: '800' }}>
                    {formatPrice(Number(d.price))}
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
                  <Emoji3D name="cross_mark" size={22} />
                </Pressable>
              </Card3D>
            ))}

            {draft ? (
              <>
                <DishEditor title={t('addDish')} value={draft} onChange={setDraft} onRemove={() => setDraft(null)} />
                <Button3D title={t('saveDish')} emoji="check" onPress={save} loading={busy} />
              </>
            ) : (
              <Button3D title={t('addDish')} emoji="plus" onPress={() => setDraft(emptyDish())} />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 8 },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dishRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
