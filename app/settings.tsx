import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Platform, ScrollView, Switch, View } from 'react-native';

import { Icon, ListGroup, ListRow, Screen, ScreenHeader, Txt } from '@/components/ui';
import { useDeleteAccount } from '@/lib/account';
import { useAddresses } from '@/lib/addresses';
import { useMyAllergies } from '@/lib/allergies';
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
  const { start: deleteAccount, busy: deleting } = useDeleteAccount(clear);
  const { allergies } = useMyAllergies();
  const { addresses } = useAddresses();

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
          <ListRow
            icon="location-outline"
            label={t('savedAddresses')}
            detail={addresses.length ? t('addrCount', { n: addresses.length }) : t('addrNone')}
            onPress={() => router.push('/addresses')}
          />
          <ListRow
            icon="warning-outline"
            label={t('myAllergies')}
            detail={allergies.length ? allergies.map((a) => t(`al_${a}`)).join(', ') : t('myAllergiesNone')}
            onPress={() => router.push('/allergies')}
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

        <ListGroup>
          <ListRow
            icon="trash-outline"
            label={t('deleteAccount')}
            detail={t('deleteAccountDetail')}
            onPress={deleting ? undefined : deleteAccount}
            color={colors.danger}
            right={<View />}
          />
        </ListGroup>

        <Txt variant="caption" muted center>
          {"Kitchy's"} · {t('version')} {(Constants.expoConfig?.version ?? '').replace(/\.0$/, '')}
        </Txt>
      </ScrollView>
    </Screen>
  );
}
