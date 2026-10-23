import { router } from 'expo-router';

import { Walkthrough } from '@/components/Walkthrough';
import { useSettings } from '@/lib/settings';

export default function Onboarding() {
  const { setOnboarded } = useSettings();
  // Setting this flips the root navigator's guard and moves on to sign in.
  return <Walkthrough onDone={() => setOnboarded(true)} onFullGuide={() => router.push('/help')} />;
}
