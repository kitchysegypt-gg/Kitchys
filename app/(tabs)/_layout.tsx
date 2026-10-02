import { Tabs, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ColorValue, Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Icon, IconName, Txt } from '@/components/ui';
import { useCart } from '@/lib/cart';
import { FONT } from '@/lib/fonts';
import { useOrders } from '@/lib/orders';
import { useSettings } from '@/lib/settings';

// Show the free-delivery welcome once per app launch.
let welcomeShown = false;

export default function TabLayout() {
  const { t, colors, wantsChefApply, setWantsChefApply } = useSettings();
  const { count } = useCart();
  const { freeDeliveriesLeft, loaded } = useOrders();
  const [showWelcome, setShowWelcome] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!wantsChefApply) return;
    setWantsChefApply(false);
    welcomeShown = true;
    router.push('/apply');
  }, [wantsChefApply, setWantsChefApply]);

  useEffect(() => {
    if (welcomeShown || !loaded || freeDeliveriesLeft === 0) return;
    const timer = setTimeout(() => {
      welcomeShown = true;
      setShowWelcome(true);
    }, 600);
    return () => clearTimeout(timer);
  }, [loaded, freeDeliveriesLeft]);

  // Outline icon normally, filled when the tab is selected.
  const icon = (name: string) =>
    function TabIcon({ focused, color }: { focused: boolean; color: ColorValue }) {
      return <Icon name={(focused ? name : `${name}-outline`) as IconName} size={25} color={color} />;
    };

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: { fontFamily: FONT.semibold, fontSize: 11.5 },
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            height: 64 + insets.bottom,
            paddingTop: 6,
            paddingBottom: insets.bottom + 6,
          },
        }}>
        <Tabs.Screen name="index" options={{ title: t('tabHome'), tabBarIcon: icon('home') }} />
        <Tabs.Screen name="chefs" options={{ title: t('tabChefs'), tabBarIcon: icon('restaurant') }} />
        <Tabs.Screen
          name="cart"
          options={{
            title: t('tabCart'),
            tabBarIcon: icon('cart'),
            tabBarBadge: count > 0 ? count : undefined,
            tabBarBadgeStyle: { backgroundColor: colors.primary, color: colors.onPrimary, fontWeight: '700' },
          }}
        />
        <Tabs.Screen name="orders" options={{ title: t('tabOrders'), tabBarIcon: icon('receipt') }} />
        <Tabs.Screen name="more" options={{ title: t('tabMore'), tabBarIcon: icon('menu') }} />
      </Tabs>

      <Modal visible={showWelcome} transparent animationType="fade" onRequestClose={() => setShowWelcome(false)}>
        <View style={styles.backdrop}>
          <Card style={styles.welcome}>
            <View style={[styles.welcomeArt, { backgroundColor: colors.surfaceAlt }]}>
              <Icon name="delivery" size={48} color={colors.primary} />
            </View>
            <Txt variant="title" center>
              {t('freeDeliveryTitle')}
            </Txt>
            <Txt center muted style={{ marginVertical: 12, fontSize: 16 }}>
              {t('freeDeliveryWelcome')}
            </Txt>
            <View style={[styles.pill, { backgroundColor: colors.successBg }]}>
              <Txt style={{ fontWeight: '700', color: colors.success }} center>
                {t('freeDeliveryBanner', { n: freeDeliveriesLeft })}
              </Txt>
            </View>
            <Button title={t('awesome')} onPress={() => setShowWelcome(false)} />
          </Card>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  welcome: { padding: 24 },
  welcomeArt: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  pill: { borderRadius: 14, padding: 10, marginBottom: 18 },
});
