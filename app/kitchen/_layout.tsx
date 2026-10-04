import { Tabs } from 'expo-router';
import { ActivityIndicator, ColorValue, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, Icon, IconName, ScreenHeader } from '@/components/ui';
import { FONT } from '@/lib/fonts';
import { KitchenProvider, leaveKitchen, useKitchen } from '@/lib/kitchen';
import { useSettings } from '@/lib/settings';

function KitchenTabs() {
  const { t, colors } = useSettings();
  const { kitchen, loading, openOrders } = useKitchen();
  const insets = useSafeAreaInsets();

  if (!kitchen) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SafeAreaView edges={['top']}>
          <ScreenHeader title={t('myKitchen')} onBack={leaveKitchen} />
        </SafeAreaView>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        ) : (
          <EmptyState icon="hourglass-outline" title={t('applicationPending')} body={t('applicationSentBody')} />
        )}
      </View>
    );
  }

  const icon = (name: IconName) =>
    function TabIcon({ color }: { focused: boolean; color: ColorValue }) {
      return <Icon name={name} size={24} color={color as string} />;
    };
  const waiting = openOrders.filter((o) => o.status === 'placed').length;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: FONT.semibold, fontSize: 11, marginTop: 2 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 66 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 6,
        },
      }}>
      <Tabs.Screen name="index" options={{ title: t('kitchenDashboard'), tabBarIcon: icon('stats-chart-outline') }} />
      <Tabs.Screen
        name="orders"
        options={{
          title: t('kitchenOrders'),
          tabBarIcon: icon('receipt-outline'),
          tabBarBadge: waiting > 0 ? waiting : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary, color: colors.onPrimary, fontWeight: '700' },
        }}
      />
      <Tabs.Screen name="menu" options={{ title: t('kitchenMenu'), tabBarIcon: icon('restaurant-outline') }} />
      <Tabs.Screen name="reviews" options={{ title: t('kitchenReviews'), tabBarIcon: icon('star-outline') }} />
      <Tabs.Screen name="settings" options={{ title: t('kitchenSettings'), tabBarIcon: icon('options-outline') }} />
    </Tabs>
  );
}

/** The chef's kitchen: its own little app with a dashboard, orders, menu, reviews and settings. */
export default function KitchenLayout() {
  return (
    <KitchenProvider>
      <KitchenTabs />
    </KitchenProvider>
  );
}
