import { Tabs, router } from 'expo-router';
import { useEffect } from 'react';
import { ColorValue, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, KitchyIconName } from '@/components/ui';
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

  // Kitchy's own icons: grey normally, brand colour when the tab is selected.
  const icon = (name: KitchyIconName) =>
    function TabIcon({ color }: { focused: boolean; color: ColorValue }) {
      return (
        <View style={styles.tabIcon}>
          <Icon name={name} size={25} color={color as string} />
        </View>
      );
    };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: FONT.semibold, fontSize: 11.5, marginTop: 2 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 68 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 6,
        },
      }}>
      <Tabs.Screen name="index" options={{ title: t('tabHome'), tabBarIcon: icon('k-home') }} />
      <Tabs.Screen name="chefs" options={{ title: t('tabChefs'), tabBarIcon: icon('k-chefs') }} />
      <Tabs.Screen
        name="cart"
        options={{
          title: t('tabCart'),
          tabBarIcon: icon('k-cart'),
          tabBarBadge: count > 0 ? count : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary, color: colors.onPrimary, fontWeight: '700' },
        }}
      />
      <Tabs.Screen name="orders" options={{ title: t('tabOrders'), tabBarIcon: icon('k-orders') }} />
      <Tabs.Screen name="more" options={{ title: t('tabMore'), tabBarIcon: icon('k-more') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIcon: { height: 28, alignItems: 'center', justifyContent: 'center' },
});
