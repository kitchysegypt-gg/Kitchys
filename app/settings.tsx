import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Platform, ScrollView, Switch, View } from 'react-native';

import { Icon, ListGroup, ListRow, Screen, ScreenHeader, Txt } from '@/components/ui';
import { useCart } from '@/lib/cart';
import { LANGUAGES } from '@/lib/i18n';
import { forgetThisPhone } from '@/lib/notifications';
import { useSettings } from '@/lib/settings';
import { supabase } from '@/lib/supabase';

export default function SettingsScreen() {
  const {
    t,
    colors,
    language,
    setLanguage,
    soundEnabled,
    setSoundEnabled,
    notificationsEnabled,
    setNotificationsEnabled,
  } = useSettings();
  const { clear } = useCart();

  const signOut = async () => {
    clear();
    await forgetThisPhone().catch(() => {});
    await supabase.auth.signOut();
  };

  const check = <Icon name="checkmark" size={22} color={colors.primary} />;

  return (
    <Screen>
      <ScreenHeader title={t('settings')} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 22, paddingBottom: 40 }}>
        <ListGroup>
          <ListRow
            icon="gift-outline"
            label={t('referFriend')}
            detail={t('referTagline')}
            onPress={() => router.push('/refer')}
          />
        </ListGroup>

        <ListGroup title={t('language')}>
          {LANGUAGES.map((lang) => (
            <ListRow
              key={lang.code}
              icon="language-outline"
              label={lang.label}
              onPress={() => setLanguage(lang.code)}
              right={language === lang.code ? check : <View />}
            />
          ))}
        </ListGroup>

        <ListGroup>
          <ListRow
            icon="volume-medium-outline"
            label={t('sounds')}
            right={
              <Switch
                value={soundEnabled}
                onValueChange={setSoundEnabled}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor="#fff"
              />
            }
          />
          {Platform.OS !== 'web' && (
            <ListRow
              icon="notifications-outline"
              label={t('notifications')}
              detail={t('notificationsDetail')}
              right={
                <Switch
                  value={notificationsEnabled}
                  onValueChange={setNotificationsEnabled}
                  trackColor={{ true: colors.primary, false: colors.border }}
                  thumbColor="#fff"
                />
              }
            />
          )}
          <ListRow icon="log-out-outline" label={t('signOut')} onPress={signOut} color={colors.danger} right={<View />} />
        </ListGroup>

        <Txt variant="caption" muted center>
          {"Kitchy's"} · {t('version')} {(Constants.expoConfig?.version ?? '').replace(/\.0$/, '')}
        </Txt>
      </ScrollView>
    </Screen>
  );
}
