import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { ActivityIndicator, ColorValue, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RiderApply } from '@/components/RiderApply';
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

  // Same as the Kitchy's app: the selected tab is a small orange rounded square with a white
  // icon, the others are dark-brown outline icons.
  type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
  const icon = (outline: IoniconName, filled: IoniconName) =>
    function TabIcon({ focused }: { focused: boolean; color: ColorValue }) {
      return (
        <View style={[styles.tabIcon, focused && { backgroundColor: colors.primary }]}>
          <Ionicons name={focused ? filled : outline} size={focused ? 18 : 22} color={focused ? colors.onPrimary : colors.text} />
        </View>
      );
    };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text,
        tabBarLabelStyle: { fontFamily: FONT.semibold, fontSize: 11, marginTop: 2 },
        tabBarIconStyle: { height: 32 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          height: 76 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 12,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('riderTabDeliveries'),
          tabBarIcon: icon('bicycle-outline', 'bicycle'),
          tabBarBadge: active.length > 0 ? active.length : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary, color: colors.onPrimary, fontWeight: '700' },
        }}
      />
      <Tabs.Screen name="earnings" options={{ title: t('riderTabEarnings'), tabBarIcon: icon('wallet-outline', 'wallet') }} />
      <Tabs.Screen name="account" options={{ title: t('riderTabAccount'), tabBarIcon: icon('person-outline', 'person') }} />
      {/* Opened from the balance card; not a tab. */}
      <Tabs.Screen name="topup" options={{ href: null }} />
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
  tabIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
