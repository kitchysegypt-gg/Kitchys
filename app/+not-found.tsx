import { Link, Stack } from 'expo-router';

import { EmptyState, Screen, Txt } from '@/components/ui';
import { useSettings } from '@/lib/settings';

export default function NotFoundScreen() {
  const { t, colors } = useSettings();
  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <EmptyState emoji="search" title={t('noResults')}>
        <Link href="/">
          <Txt style={{ color: colors.primary, fontWeight: '800' }}>{t('tabHome')}</Txt>
        </Link>
      </EmptyState>
    </Screen>
  );
}
