import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { DishCard } from '@/components/menu';
import { Button, EmptyState, Screen, ScreenHeader } from '@/components/ui';
import { useCatalog } from '@/lib/catalog';
import { useFavorites } from '@/lib/favorites';
import { useSettings } from '@/lib/settings';

/** More > Favourite meals: the dishes the customer saved with the heart. */
export default function FavoritesScreen() {
  const { t } = useSettings();
  const { ids } = useFavorites();
  const { getDish } = useCatalog();
  // Dishes a chef took off the menu simply don't show until they're back.
  const dishes = [...ids].flatMap((id) => {
    const dish = getDish(id);
    return dish ? [dish] : [];
  });

  return (
    <Screen>
      <ScreenHeader title={t('favoritesTitle')} />
      {dishes.length === 0 ? (
        <EmptyState icon="heart" title={t('favoritesEmpty')} body={t('favoritesEmptyBody')}>
          <Button title={t('browseDishes')} icon="restaurant-outline" onPress={() => router.navigate('/')} />
        </EmptyState>
      ) : (
        <ScrollView contentContainerStyle={styles.grid}>
          {dishes.map((d) => (
            <View key={d.id} style={styles.item}>
              <DishCard dish={d} wide />
            </View>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12, padding: 16, paddingTop: 4 },
  item: { width: '48.5%' },
});
