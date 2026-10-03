import { router } from 'expo-router';

import { Walkthrough } from '@/components/Walkthrough';

export default function Guide() {
  return <Walkthrough onDone={() => router.back()} />;
}
