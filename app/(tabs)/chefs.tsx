import { ScrollView, View } from 'react-native';

import { Emoji3D } from '@/components/Emoji3D';
import { ChefCard } from '@/components/menu';
import { Screen, Txt } from '@/components/ui';
import { useCatalog } from '@/lib/catalog';
import { useSettings } from '@/lib/settings';

export default function ChefsScreen() {
  const { t } = useSettings();
  const { chefs, dishesByChef } = useCatalog();
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Emoji3D name="grandma_2" size={56} float sway />
          <View style={{ flex: 1 }}>
            <Txt variant="title">{t('homeChefs')}</Txt>
            <Txt muted>{t('onb1Body')}</Txt>
          </View>
        </View>
        {chefs.map((c) => (
          <ChefCard key={c.id} chef={c} dishCount={dishesByChef(c.id).length} />
        ))}
      </ScrollView>
    </Screen>
  );
}
