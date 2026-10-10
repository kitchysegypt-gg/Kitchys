import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AlertHost } from '@/components/AlertHost';
import { IntroAnimation } from '@/components/IntroAnimation';
import { AuthProvider, useAuth } from '@/lib/auth';
import { CartProvider } from '@/lib/cart';
import { CatalogProvider } from '@/lib/catalog';
import { FONT_FILES } from '@/lib/fonts';
import { NotificationsBridge } from '@/lib/notifications';
import { OrdersProvider } from '@/lib/orders';
import { SettingsProvider, useSettings } from '@/lib/settings';
import { SoundProvider } from '@/lib/sound';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

// The opening animation plays once each time the app starts.
let introPlayed = false;

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
                  <AlertHost />
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
  const [showIntro, setShowIntro] = useState(!introPlayed);
  // A font that fails to load falls back to the system font rather than blocking the app.
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  const ready = loaded && !loading && (fontsLoaded || !!fontError);

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
    <View style={{ flex: 1 }}>
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
            <Stack.Screen name="checkout" />
            <Stack.Screen name="location" />
            <Stack.Screen name="apply" />
            <Stack.Screen name="kitchen" />
            <Stack.Screen name="rewards" />
            <Stack.Screen name="chat" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="refer" />
            <Stack.Screen name="review/[orderId]" options={{ presentation: 'modal' }} />
          </Stack.Protected>

          {/* The full guide is open to everyone, also before signing in. Listed last so it is
              never the screen the app opens on. */}
          <Stack.Screen name="help" />
        </Stack>
        {onboarded && session && <NotificationsBridge />}
      </ThemeProvider>
      {showIntro && (
        <IntroAnimation
          onDone={() => {
            introPlayed = true;
            setShowIntro(false);
          }}
        />
      )}
    </View>
  );
}
