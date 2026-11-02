import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ChefPhoto } from '@/components/media';
import { Logo } from '@/components/Logo';
import { Button, Card, Icon, IconName, Screen, Txt } from '@/components/ui';
import { LANGUAGES } from '@/lib/i18n';
import { showAlert } from '@/lib/alert';
import { useSettings } from '@/lib/settings';
import { FONT } from '@/lib/fonts';
import { isDemo, isSupabaseConfigured, supabase } from '@/lib/supabase';

export default function AuthScreen() {
  const { t, colors, language, setLanguage, isRTL, wantsChefApply, setWantsChefApply } = useSettings();
  // 'verify': the account was created and is waiting for the 6-digit code from the email.
  const [mode, setMode] = useState<'signIn' | 'signUp' | 'verify'>('signIn');
  const [code, setCode] = useState('');
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

    if (error) {
      // A network failure (offline, or a page that isn't allowed to reach the server).
      if (error.name === 'AuthRetryableFetchError' || /fetch|network/i.test(error.message)) {
        return showAlert(t('error'), t('cantReachServer'));
      }
      // Signed up but never confirmed: send a fresh code and ask for it.
      if (mode === 'signIn' && /not confirmed/i.test(error.message)) {
        await supabase.auth.resend({ type: 'signup', email: email.trim() }).catch(() => {});
        setCode('');
        return setMode('verify');
      }
      return showAlert(t('error'), error.message);
    }
    // With "Confirm email" on in Supabase, sign-up returns no session until the email is confirmed.
    if (mode === 'signUp' && !data.session) {
      setCode('');
      setMode('verify');
    }
  };

  const verify = async () => {
    const token = code.replace(/\D/g, '');
    if (token.length < 6) return showAlert(t('error'), t('enterCode'));
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: 'signup' });
    setBusy(false);
    // On success the new session signs them in and the app moves on by itself.
    if (error) showAlert(t('error'), /expired|invalid/i.test(error.message) ? t('codeWrong') : error.message);
  };

  const resendCode = async () => {
    setBusy(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
    setBusy(false);
    showAlert(t('email'), error ? error.message : t('codeSent', { email: email.trim() }));
  };

  const input = (icon: IconName, props: React.ComponentProps<typeof TextInput>) => (
    <View style={[styles.inputWrap, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
      <Icon name={icon} size={20} color={colors.textMuted} />
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
                <Txt
                  variant="caption"
                  style={{ fontWeight: '600', color: language === lang.code ? colors.primary : colors.text }}>
                  {lang.label}
                </Txt>
              </Pressable>
            ))}
          </View>

          <View style={{ marginVertical: 12 }}>
            <Logo width={200} />
          </View>
          <Txt muted center style={{ marginBottom: 20 }}>
            {t('authWelcome')}
          </Txt>

          {isDemo && (
            <View style={[styles.freeHint, { backgroundColor: colors.surfaceAlt, marginBottom: 14 }]}>
              <Icon name="information-circle-outline" size={22} color={colors.primary} />
              <Txt variant="caption" style={{ flex: 1, fontWeight: '500' }}>
                {t('demoHint')}
              </Txt>
            </View>
          )}

          {mode === 'verify' ? (
            <Card style={{ gap: 12, padding: 18 }}>
              <Txt variant="heading">{t('confirmEmailTitle')}</Txt>
              <Txt muted>{t('confirmEmailBody', { email: email.trim() })}</Txt>
              <TextInput
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
                accessibilityLabel={t('enterCode')}
                style={[
                  styles.code,
                  { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text },
                ]}
              />
              <Button title={t('confirmEmailButton')} onPress={verify} loading={busy} />
              <View style={styles.verifyLinks}>
                <Pressable onPress={resendCode} disabled={busy} hitSlop={8}>
                  <Txt style={{ color: colors.primary, fontWeight: '600' }}>{t('resendCode')}</Txt>
                </Pressable>
                <Pressable onPress={() => setMode('signIn')} hitSlop={8}>
                  <Txt muted>{t('useAnotherEmail')}</Txt>
                </Pressable>
              </View>
            </Card>
          ) : (
            <Card style={{ gap: 12, padding: 18 }}>
              <Txt variant="heading" style={{ marginBottom: 4 }}>
                {mode === 'signIn' ? t('signIn') : t('signUp')}
              </Txt>

              {mode === 'signUp' &&
                input('person-outline', {
                  placeholder: t('fullName'),
                  value: name,
                  onChangeText: setName,
                  autoComplete: 'name',
                })}
              {input('mail-outline', {
                placeholder: t('email'),
                value: email,
                onChangeText: setEmail,
                autoCapitalize: 'none',
                keyboardType: 'email-address',
                autoComplete: 'email',
              })}
              {input('lock-closed-outline', {
                placeholder: t('password'),
                value: password,
                onChangeText: setPassword,
                secureTextEntry: true,
                autoComplete: mode === 'signIn' ? 'current-password' : 'new-password',
              })}

              <Button
                title={mode === 'signIn' ? t('signIn') : t('signUp')}
                onPress={submit}
                loading={busy}
                style={{ marginTop: 6 }}
              />
            </Card>
          )}

          <Pressable onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')} style={{ padding: 16 }}>
            <Txt center style={{ color: colors.primary, fontWeight: '600' }}>
              {mode === 'signIn' ? t('noAccount') : t('haveAccount')}
            </Txt>
          </Pressable>

          <Pressable onPress={() => router.push('/help')} accessibilityRole="button" style={{ marginBottom: 12 }}>
            <View style={[styles.guideLink, { borderColor: colors.primary, backgroundColor: colors.surface }]}>
              <Icon name="book-outline" size={24} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Txt style={{ fontWeight: '800', color: colors.primary }}>{t('helpNewHere')}</Txt>
                <Txt variant="caption" muted>
                  {t('helpNewHereBody')}
                </Txt>
              </View>
              <Icon name={isRTL ? 'chevron-back' : 'chevron-forward'} size={20} color={colors.primary} />
            </View>
          </Pressable>

          <View style={[styles.freeHint, { backgroundColor: colors.successBg }]}>
            <Icon name="delivery" size={26} color={colors.success} />
            <Txt style={{ flex: 1, fontWeight: '500', color: colors.success }}>{t('onb7Body')}</Txt>
          </View>

          <Pressable
            onPress={() => {
              setWantsChefApply(true);
              setMode('signUp');
            }}
            style={[
              styles.chefApply,
              { borderColor: wantsChefApply ? colors.primary : colors.border, backgroundColor: colors.surface },
            ]}>
            <ChefPhoto size={48} />
            <View style={{ flex: 1 }}>
              <Txt style={{ fontWeight: '700', color: colors.primary }}>{t('applyChefLink')}</Txt>
              {wantsChefApply && (
                <Txt variant="caption" muted>
                  {t('applyChefNote')}
                </Txt>
              )}
            </View>
            <Icon name={isRTL ? 'chevron-back' : 'chevron-forward'} size={20} color={colors.textMuted} />
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  code: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    fontSize: 28,
    letterSpacing: 10,
    textAlign: 'center',
    fontFamily: FONT.bold,
  },
  guideLink: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1.5 },
  verifyLinks: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 },
  chefApply: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 12,
  },
  langRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 8 },
  lang: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  input: { flex: 1, paddingVertical: 14, fontSize: 16, fontFamily: FONT.regular },
  freeHint: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16 },
});
