import { createAudioPlayer, setAudioModeAsync, setIsAudioActiveAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { createContext, useContext, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';

import { useSettings } from './settings';

const ORDER_SUCCESS = require('@/assets/sounds/order-success.wav');

type SoundContextValue = {
  /** The chef's "new order" ping (and the rewards screen). */
  playOrderSuccess: () => void;
};

const SoundContext = createContext<SoundContextValue>({
  playOrderSuccess: () => {},
});

/**
 * Plays a short sound with its own player, released once it finishes. A fresh player per
 * sound is more reliable on Android than rewinding a shared one, and quick taps can overlap.
 */
function playOnce(source: number) {
  try {
    const player = createAudioPlayer(source);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      subscription.remove();
      player.release();
    };
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) release();
    });
    player.volume = 1;
    player.play();
    // In case "finished" never arrives (e.g. the app goes to the background).
    setTimeout(release, 5000);
  } catch {
    // Sound is a nice-to-have; never block the action on it.
  }
}

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const { soundEnabled } = useSettings();

  useEffect(() => {
    setIsAudioActiveAsync(true).catch(() => {});
    // Short UI sounds: play alongside other apps' audio, and even with the iPhone's silent switch on.
    setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({
      playOrderSuccess: () => {
        if (soundEnabled) playOnce(ORDER_SUCCESS);
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      },
    }),
    [soundEnabled]
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSounds() {
  return useContext(SoundContext);
}
