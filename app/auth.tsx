import { Image } from 'expo-image';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Emoji3D } from '@/components/Emoji3D';
import { Button3D, Card3D, Screen, Txt } from '@/components/ui';
import { EmojiName } from '@/lib/emoji';
import { LANGUAGES } from '@/lib/i18n';
import { showAlert } from '@/lib/alert';
import { useSettings } from '@/lib/settings';
import { isDemo, isSupabaseConfigured, supabase } from '@/lib/supabase';

export default function AuthScreen() {
  const { t, colors, language, setLanguage, isRTL } = useSettings();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!isSupabaseConfigured) return showAlert(t('error'), t('supabaseMissing'));
    if (!email.trim() || password.length < 6) return showAlert(t('error'), t('fillAllFields'));

    setBusy(true);
    const { data, error } =
      mode === 'signIn'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { data: { full_name: name.trim() } },
          });
    setBusy(false);

    if (error) return showAlert(t('error'), error.message);
    // With "Confirm email" on in Supabase, sign-up returns no session until the link is clicked.
    if (mode === 'signUp' && !data.session) {
      showAlert('📧', t('checkEmail'));
      setMode('signIn');
    }
  };

  const input = (icon: EmojiName, props: React.ComponentProps<typeof TextInput>) => (
    <View style={[styles.inputWrap, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
      <Emoji3D name={icon} size={26} />
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { color: colors.text, textAlign: isRTL ? 'right' : 'left' }]}
        {...props}
      />
    </View>
  );

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.langRow}>
            {LANGUAGES.map((lang) => (
              <Pressable
                key={lang.code}
                onPress={() => setLanguage(lang.code)}
                style={[
                  styles.lang,
                  {
                    borderColor: language === lang.code ? colors.primary : colors.border,
                    backgroundColor: colors.surface,
                  },
                ]}>
                <Txt variant="caption" style={{ fontWeight: '700' }}>
                  {lang.flag} {lang.label}
                </Txt>
              </Pressable>
            ))}
          </View>

          <View style={[styles.logoWrap, { shadowColor: colors.shadow }]}>
            <Image source={require('@/assets/images/logo.png')} style={styles.logo} contentFit="contain" />
          </View>
          <Txt muted center style={{ marginBottom: 20 }}>
            {t('authWelcome')}
          </Txt>

          {isDemo && (
            <View style={[styles.freeHint, { backgroundColor: colors.surfaceAlt, marginBottom: 14 }]}>
              <Emoji3D name="sparkles" size={28} />
              <Txt variant="caption" style={{ flex: 1, fontWeight: '700' }}>
                {t('demoHint')}
              </Txt>
            </View>
          )}

          <Card3D style={{ gap: 12, padding: 18 }}>
            <View style={styles.titleRow}>
              <Emoji3D name={mode === 'signIn' ? 'wave' : 'sparkles'} size={40} float sway />
              <Txt variant="heading">{mode === 'signIn' ? t('signIn') : t('signUp')}</Txt>
            </View>

            {mode === 'signUp' &&
              input('user', { placeholder: t('fullName'), value: name, onChangeText: setName, autoComplete: 'name' })}
            {input('email', {
              placeholder: t('email'),
              value: email,
              onChangeText: setEmail,
              autoCapitalize: 'none',
              keyboardType: 'email-address',
              autoComplete: 'email',
            })}
            {input('key', {
              placeholder: t('password'),
              value: password,
              onChangeText: setPassword,
              secureTextEntry: true,
              autoComplete: mode === 'signIn' ? 'current-password' : 'new-password',
            })}

            <Button3D
              title={mode === 'signIn' ? t('signIn') : t('signUp')}
              emoji={mode === 'signIn' ? 'locked' : 'sparkles'}
              onPress={submit}
              loading={busy}
              style={{ marginTop: 6 }}
            />
          </Card3D>

          <Pressable onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')} style={{ padding: 16 }}>
            <Txt center style={{ color: colors.primary, fontWeight: '700' }}>
              {mode === 'signIn' ? t('noAccount') : t('haveAccount')}
            </Txt>
          </Pressable>

          <View style={[styles.freeHint, { backgroundColor: colors.surfaceAlt }]}>
            <Emoji3D name="gift" size={36} float />
            <Txt style={{ flex: 1, fontWeight: '700' }}>{t('onb5Body')}</Txt>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  langRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 8 },
  lang: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1.5 },
  logoWrap: {
    alignSelf: 'center',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  logo: { width: 240, height: 200 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderBottomWidth: 3,
    paddingHorizontal: 12,
  },
  input: { flex: 1, paddingVertical: 14, fontSize: 16 },
  freeHint: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18 },
});
