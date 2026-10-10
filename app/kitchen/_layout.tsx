import { Tabs } from 'expo-router';
import { ActivityIndicator, ColorValue, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, Icon, IconName, ScreenHeader, filledIcon } from '@/components/ui';
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
    function TabIcon({ focused, color }: { focused: boolean; color: ColorValue }) {
      // The selected tab shows a filled icon on a soft tile.
      return (
        <View style={[styles.tabIcon, focused && { backgroundColor: `${colors.primary}1A` }]}>
          <Icon name={focused ? filledIcon(name) : name} size={22} color={color as string} />
        </View>
      );
    };
  const waiting = openOrders.filter((o) => o.status === 'placed' && !o.accepted_at).length;

  return (
    <Tabs
      backBehavior="history"
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
      {/* Opened from the dashboard and settings, not a tab of its own. */}
      <Tabs.Screen name="premium" options={{ href: null }} />
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

const styles = StyleSheet.create({
  tabIcon: { width: 44, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
