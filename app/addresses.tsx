import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, EmptyState, Icon, IconName, Screen, ScreenHeader, Txt } from '@/components/ui';
import { AddressKind, SavedAddress, samePlace, useAddressName, useAddresses } from '@/lib/addresses';
import { showAlert, showConfirm } from '@/lib/alert';
import { useSettings } from '@/lib/settings';

const KIND_ICON: Record<AddressKind, IconName> = {
  home: 'home',
  work: 'briefcase-outline',
  family: 'people-outline',
  other: 'location',
};

/** Settings > Saved addresses: tap one to deliver there, add new ones, remove old ones. */
export default function AddressesScreen() {
  const { t, colors, location, setLocation } = useSettings();
  const { addresses, loaded, remove } = useAddresses();
  const nameOf = useAddressName();
  const [busy, setBusy] = useState<string | null>(null);

  const deliverHere = (a: SavedAddress) => {
    setLocation({ latitude: a.latitude, longitude: a.longitude, address: a.address, details: a.details });
    router.back();
  };

  const askRemove = (a: SavedAddress) =>
    showConfirm(t('addrRemoveTitle'), t('addrRemoveBody', { name: nameOf(a) }), {
      label: t('addrRemove'),
      cancelLabel: t('cancel'),
      onConfirm: async () => {
        setBusy(a.id);
        try {
          await remove(a.id);
        } catch (e: any) {
          showAlert(t('error'), e?.message ?? String(e));
        } finally {
          setBusy(null);
        }
      },
    });

  const addNew = () => router.push({ pathname: '/location', params: { save: '1' } });

  return (
    <Screen>
      <ScreenHeader title={t('savedAddresses')} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 12, paddingBottom: 40 }}>
        {loaded && addresses.length === 0 ? (
          <EmptyState icon="location-outline" title={t('addrEmptyTitle')} body={t('addrEmptyBody')} />
        ) : (
          <Txt muted>{t('addrIntro')}</Txt>
        )}

        {addresses.map((a) => {
          const current = samePlace(location, a);
          return (
            <Pressable key={a.id} onPress={() => deliverHere(a)} accessibilityRole="button" accessibilityLabel={`${t('addrDeliverHere')}: ${nameOf(a)}`}>
              <Card style={[styles.row, current && { borderColor: colors.primary, borderWidth: 2 }]}>
                <Icon name={KIND_ICON[a.kind]} size={30} color={colors.primary} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt style={{ fontWeight: '700', fontSize: 16 }}>{nameOf(a)}</Txt>
                  <Txt variant="caption" muted numberOfLines={2}>
                    {[a.address, a.details].filter(Boolean).join(', ')}
                  </Txt>
                  {current && (
                    <Txt variant="caption" style={{ color: colors.primary, fontWeight: '700' }}>
                      {t('addrCurrent')}
                    </Txt>
                  )}
                </View>
                <Pressable
                  onPress={() => askRemove(a)}
                  disabled={busy === a.id}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={t('addrRemove')}>
                  <Icon name="trash-outline" size={22} color={colors.textMuted} />
                </Pressable>
              </Card>
            </Pressable>
          );
        })}

        <Button title={t('addrAddNew')} icon="add" onPress={addNew} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
