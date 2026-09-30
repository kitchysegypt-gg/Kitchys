import { Tabs, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Emoji3D } from '@/components/Emoji3D';
import { Button3D, Card3D, Txt } from '@/components/ui';
import { useCart } from '@/lib/cart';
import { EmojiName } from '@/lib/emoji';
import { useOrders } from '@/lib/orders';
import { useSettings } from '@/lib/settings';

// Show the free-delivery welcome once per app launch.
let welcomeShown = false;

function TabIcon({ name, focused }: { name: EmojiName; focused: boolean }) {
  return (
    <View
      style={{
        transform: [{ scale: focused ? 1.15 : 0.95 }, { translateY: focused ? -2 : 0 }],
        opacity: focused ? 1 : 0.75,
      }}>
      <Emoji3D name={name} size={26} />
    </View>
  );
}

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

  const icon = (name: EmojiName) =>
    function Icon({ focused }: { focused: boolean }) {
      return <TabIcon name={name} focused={focused} />;
    };

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: { fontWeight: '700', fontSize: 10 },
          tabBarItemStyle: { paddingHorizontal: 0 },
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            // Room for the 3D emoji icons plus the label, above the home indicator.
            height: 68 + insets.bottom,
            paddingTop: 6,
            paddingBottom: insets.bottom + 6,
          },
        }}>
        <Tabs.Screen name="index" options={{ title: t('tabHome'), tabBarIcon: icon('house') }} />
        <Tabs.Screen name="chefs" options={{ title: t('tabChefs'), tabBarIcon: icon('chef_1') }} />
        <Tabs.Screen
          name="cart"
          options={{
            title: t('tabCart'),
            tabBarIcon: icon('cart'),
            tabBarBadge: count > 0 ? count : undefined,
            tabBarBadgeStyle: { backgroundColor: colors.primary, color: colors.onPrimary, fontWeight: '800' },
          }}
        />
        <Tabs.Screen name="orders" options={{ title: t('tabOrders'), tabBarIcon: icon('receipt') }} />
        <Tabs.Screen name="rewards" options={{ title: t('tabRewards'), tabBarIcon: icon('trophy') }} />
        <Tabs.Screen name="chat" options={{ title: t('tabChat'), tabBarIcon: icon('robot') }} />
        <Tabs.Screen name="settings" options={{ title: t('tabSettings'), tabBarIcon: icon('gear') }} />
      </Tabs>

      <Modal visible={showWelcome} transparent animationType="fade" onRequestClose={() => setShowWelcome(false)}>
        <View style={styles.backdrop}>
          <Card3D style={styles.welcome}>
            <View style={styles.welcomeArt}>
              <Emoji3D name="gift" size={70} />
              <Emoji3D name="truck" size={120} float />
              <Emoji3D name="party" size={70} />
            </View>
            <Txt variant="title" center>
              {t('freeDeliveryTitle')}
            </Txt>
            <Txt center muted style={{ marginVertical: 12, fontSize: 16 }}>
              {t('freeDeliveryWelcome')}
            </Txt>
            <View style={[styles.pill, { backgroundColor: colors.surfaceAlt }]}>
              <Txt style={{ fontWeight: '800', color: colors.success }} center>
                {t('freeDeliveryBanner', { n: freeDeliveriesLeft })}
              </Txt>
            </View>
            <Button3D title={t('awesome')} emoji="thumbs_up" onPress={() => setShowWelcome(false)} />
          </Card3D>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  welcome: { padding: 24 },
  welcomeArt: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', marginBottom: 8 },
  pill: { borderRadius: 14, padding: 10, marginBottom: 18 },
});
