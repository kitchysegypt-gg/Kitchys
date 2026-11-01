import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, router } from 'expo-router';
import { useEffect } from 'react';
import { ColorValue, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCart } from '@/lib/cart';
import { FONT } from '@/lib/fonts';
import { useSettings } from '@/lib/settings';

export default function TabLayout() {
  const { t, colors, wantsChefApply, setWantsChefApply } = useSettings();
  const { count } = useCart();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!wantsChefApply) return;
    setWantsChefApply(false);
    router.push('/apply');
  }, [wantsChefApply, setWantsChefApply]);

  // The selected tab is a solid orange rounded square with a white icon; the others are simple
  // dark-brown outline icons.
  type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
  const icon = (outline: IoniconName, filled: IoniconName) =>
    function TabIcon({ focused }: { focused: boolean; color: ColorValue }) {
      return (
        <View style={[styles.tabIcon, focused && { backgroundColor: colors.primary }]}>
          <Ionicons name={focused ? filled : outline} size={focused ? 21 : 24} color={focused ? colors.onPrimary : colors.text} />
        </View>
      );
    };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text,
        tabBarLabelStyle: { fontFamily: FONT.semibold, fontSize: 11.5, marginTop: 4 },
        tabBarIconStyle: { height: 40 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          height: 88 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 10,
        },
      }}>
      <Tabs.Screen name="index" options={{ title: t('tabHome'), tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="chefs" options={{ title: t('tabChefs'), tabBarIcon: icon('restaurant-outline', 'restaurant') }} />
      <Tabs.Screen
        name="cart"
        options={{
          title: t('tabCart'),
          tabBarIcon: icon('cart-outline', 'cart'),
          tabBarBadge: count > 0 ? count : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary, color: colors.onPrimary, fontWeight: '700' },
        }}
      />
      <Tabs.Screen name="orders" options={{ title: t('tabOrders'), tabBarIcon: icon('receipt-outline', 'receipt') }} />
      <Tabs.Screen name="more" options={{ title: t('tabMore'), tabBarIcon: icon('grid-outline', 'grid') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
