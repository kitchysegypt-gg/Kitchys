import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/lib/auth';
import { CartProvider } from '@/lib/cart';
import { CatalogProvider } from '@/lib/catalog';
import { OrdersProvider } from '@/lib/orders';
import { SettingsProvider, useSettings } from '@/lib/settings';
import { SoundProvider } from '@/lib/sound';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <AuthProvider>
          <CatalogProvider>
            <OrdersProvider>
              <CartProvider>
                <SoundProvider>
                  <RootNavigator />
                </SoundProvider>
              </CartProvider>
            </OrdersProvider>
          </CatalogProvider>
        </AuthProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { loaded, onboarded, colors } = useSettings();
  const { session, loading } = useAuth();
  const ready = loaded && !loading;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const base = colors.dark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={colors.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        {/* 1. First launch: explain how the app works. */}
        <Stack.Protected guard={!onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>

        {/* 2. Email + password sign in with Supabase. */}
        <Stack.Protected guard={onboarded && !session}>
          <Stack.Screen name="auth" />
        </Stack.Protected>

        {/* 3. The app itself. */}
        <Stack.Protected guard={onboarded && !!session}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="chef/[id]" />
          <Stack.Screen name="dish/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="guide" options={{ presentation: 'modal' }} />
          <Stack.Screen name="location" />
          <Stack.Screen name="apply" />
          <Stack.Screen name="kitchen" />
          <Stack.Screen name="rewards" />
          <Stack.Screen name="chat" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="refer" />
          <Stack.Screen name="review/[orderId]" options={{ presentation: 'modal' }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
