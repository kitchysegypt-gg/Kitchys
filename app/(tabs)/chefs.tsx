import { ScrollView } from 'react-native';

import { ChefCard } from '@/components/menu';
import { Screen, Txt } from '@/components/ui';
import { useCatalog } from '@/lib/catalog';
import { useSettings } from '@/lib/settings';

export default function ChefsScreen() {
  const { t } = useSettings();
  const { chefs, dishesByChef } = useCatalog();
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <Txt variant="title" style={{ marginTop: 8 }}>
          {t('homeChefs')}
        </Txt>
        <Txt muted style={{ marginBottom: 8 }}>
          {t('onb1Body')}
        </Txt>
        {chefs.map((c) => (
          <ChefCard key={c.id} chef={c} dishCount={dishesByChef(c.id).length} />
        ))}
      </ScrollView>
    </Screen>
  );
}
