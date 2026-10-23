import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';

import { Button, ListGroup, ListRow, Screen, ScreenHeader, Txt } from '@/components/ui';
import type { Allergen } from '@/data/menu';
import { showAlert } from '@/lib/alert';
import { ALL_ALLERGENS, useMyAllergies } from '@/lib/allergies';
import { useSettings } from '@/lib/settings';

/** Settings > My allergies: tick once, and every dish with one of them gets a warning. */
export default function AllergiesScreen() {
  const { t, colors } = useSettings();
  const { allergies, save } = useMyAllergies();
  const [picked, setPicked] = useState<Allergen[]>(allergies);
  const [busy, setBusy] = useState(false);

  const toggle = (a: Allergen, on: boolean) => setPicked((prev) => (on ? [...prev, a] : prev.filter((x) => x !== a)));

  const done = async () => {
    setBusy(true);
    try {
      await save(picked);
      router.back();
    } catch (e: any) {
      showAlert(t('error'), e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title={t('myAllergies')} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 16, paddingBottom: 40 }}>
        <Txt muted>{t('myAllergiesBody')}</Txt>
        <ListGroup>
          {ALL_ALLERGENS.map((a) => (
            <ListRow
              key={a}
              icon="warning-outline"
              label={t(`al_${a}`)}
              color={picked.includes(a) ? colors.danger : undefined}
              right={
                <Switch
                  value={picked.includes(a)}
                  onValueChange={(on) => toggle(a, on)}
                  trackColor={{ true: colors.danger, false: colors.border }}
                  thumbColor="#fff"
                />
              }
            />
          ))}
        </ListGroup>
        <View>
          <Button title={t('allergiesSave')} icon="checkmark" onPress={done} loading={busy} />
        </View>
      </ScrollView>
    </Screen>
  );
}
