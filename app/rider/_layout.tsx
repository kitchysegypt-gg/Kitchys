import { Tabs } from 'expo-router';
import { ActivityIndicator, ColorValue, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RiderApply } from '@/components/RiderApply';
import { Icon, IconName, filledIcon } from '@/components/ui';
import { FONT } from '@/lib/fonts';
import { RiderProvider, useRider } from '@/lib/rider';
import { useSettings } from '@/lib/settings';

function RiderTabs() {
  const { t, colors } = useSettings();
  const { status, active } = useRider();
  const insets = useSafeAreaInsets();

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  // Not a rider yet: apply, or wait for the team to approve.
  if (status !== 'approved') return <RiderApply />;

  const icon = (name: IconName) =>
    function TabIcon({ focused, color }: { focused: boolean; color: ColorValue }) {
      return (
        <View style={[styles.tabIcon, focused && { backgroundColor: `${colors.primary}1A` }]}>
          <Icon name={focused ? filledIcon(name) : name} size={22} color={color as string} />
        </View>
      );
    };

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
      <Tabs.Screen
        name="index"
        options={{
          title: t('riderTabDeliveries'),
          tabBarIcon: icon('bicycle-outline'),
          tabBarBadge: active.length > 0 ? active.length : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary, color: colors.onPrimary, fontWeight: '700' },
        }}
      />
      <Tabs.Screen name="earnings" options={{ title: t('riderTabEarnings'), tabBarIcon: icon('wallet-outline') }} />
      <Tabs.Screen name="account" options={{ title: t('riderTabAccount'), tabBarIcon: icon('person-outline') }} />
    </Tabs>
  );
}

/** Kitchy's Rider: deliveries, earnings and account for our own delivery riders. */
export default function RiderLayout() {
  return (
    <RiderProvider>
      <RiderTabs />
    </RiderProvider>
  );
}

const styles = StyleSheet.create({
  tabIcon: { width: 44, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});
