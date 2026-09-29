import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';

import { useSettings } from './settings';

type SoundContextValue = {
  playAddToCart: () => void;
  playOrderSuccess: () => void;
};

const SoundContext = createContext<SoundContextValue>({
  playAddToCart: () => {},
  playOrderSuccess: () => {},
});

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const { soundEnabled } = useSettings();
  const addPlayer = useAudioPlayer(require('@/assets/sounds/add-to-cart.wav'));
  const successPlayer = useAudioPlayer(require('@/assets/sounds/order-success.wav'));

  useEffect(() => {
    // Play even when the iPhone's silent switch is on — it's a short UI sound.
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  const replay = useCallback(
    (player: typeof addPlayer) => {
      if (!soundEnabled) return;
      try {
        player.seekTo(0);
        player.play();
      } catch {
        // Sound is a nice-to-have; never block the action on it.
      }
    },
    [soundEnabled]
  );

  const value = useMemo(
    () => ({
      playAddToCart: () => {
        replay(addPlayer);
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      },
      playOrderSuccess: () => {
        replay(successPlayer);
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      },
    }),
    [replay, addPlayer, successPlayer]
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSounds() {
  return useContext(SoundContext);
}
