import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSettings } from '@/lib/settings';

const HOME_WAVES = require('@/assets/images/home-waves.png');
const LOGO_MARK = require('@/assets/images/logo-mark.png');

/** Kitchy's orange, the colour of the logo and the waves. */
export const WAVE_ORANGE = '#F4511E';

/**
 * The top of Kitchy's main screens: solid orange ending in the orange and amber waves of the
 * loading screen. Children sit on the orange; status bar text turns white while it shows.
 */
export function WaveHeader({
  children,
  safeTop = true,
  lightStatusBar = true,
}: {
  children: React.ReactNode;
  safeTop?: boolean;
  /** Turn the status bar text white while the screen shows. Off inside a modal, which sets its own. */
  lightStatusBar?: boolean;
}) {
  const { colors } = useSettings();
  const insets = useSafeAreaInsets();
  useFocusEffect(
    useCallback(() => {
      if (!lightStatusBar) return;
      setStatusBarStyle('light');
      return () => setStatusBarStyle(colors.dark ? 'light' : 'dark');
    }, [colors.dark, lightStatusBar])
  );
  return (
    <View style={[styles.wrap, { paddingTop: (safeTop ? insets.top : 0) + 10 }]}>
      <Image source={HOME_WAVES} style={styles.edge} contentFit="fill" />
      {children}
    </View>
  );
}

/** The K logo on a white rounded tile, for the left of a wave header. */
export function LogoTile({ size = 42 }: { size?: number }) {
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: size / 3 }]}>
      <Image source={LOGO_MARK} style={{ width: size * 0.66, height: size * 0.72 }} contentFit="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: WAVE_ORANGE, paddingBottom: 56 },
  edge: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 122 },
  tile: { backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
});
