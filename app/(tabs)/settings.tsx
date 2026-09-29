import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Emoji3D } from '@/components/Emoji3D';
import { Button3D, Card3D, Screen, Txt } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { EmojiName } from '@/lib/emoji';
import { LANGUAGES } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { supabase } from '@/lib/supabase';
import { THEMES, ThemePreference } from '@/lib/theme';

const THEME_OPTIONS: {
  id: ThemePreference;
  emoji: EmojiName;
  label: 'themeSystem' | 'themeLight' | 'themeDark' | 'themeSunset' | 'themeMint';
}[] = [
  { id: 'system', emoji: 'gear', label: 'themeSystem' },
  { id: 'light', emoji: 'sun', label: 'themeLight' },
  { id: 'dark', emoji: 'moon', label: 'themeDark' },
  { id: 'sunset', emoji: 'hibiscus', label: 'themeSunset' },
  { id: 'mint', emoji: 'herb', label: 'themeMint' },
];

export default function SettingsScreen() {
  const { t, colors, language, setLanguage, theme, setTheme, soundEnabled, setSoundEnabled } = useSettings();
  const { session } = useAuth();
  const { clear } = useCart();

  const signOut = async () => {
    clear();
    await supabase.auth.signOut();
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
        <View style={styles.header}>
          <Emoji3D name="gear" size={52} float sway />
          <Txt variant="title">{t('settings')}</Txt>
        </View>

        {/* Account */}
        <Card3D style={styles.row}>
          <Emoji3D name="user" size={44} />
          <View style={{ flex: 1 }}>
            <Txt variant="label" muted>
              {t('account')}
            </Txt>
            <Txt style={{ fontWeight: '800' }} numberOfLines={1}>
              {(session?.user.user_metadata?.full_name as string) || session?.user.email}
            </Txt>
            {session?.user.user_metadata?.full_name ? (
              <Txt variant="caption" muted numberOfLines={1}>
                {session.user.email}
              </Txt>
            ) : null}
          </View>
        </Card3D>

        {/* Language */}
        <Section emoji="globe" title={t('language')}>
          {LANGUAGES.map((lang) => (
            <Option
              key={lang.code}
              label={`${lang.flag}  ${lang.label}`}
              selected={language === lang.code}
              onPress={() => setLanguage(lang.code)}
            />
          ))}
        </Section>

        {/* Theme */}
        <Section emoji="palette" title={t('theme')}>
          <View style={styles.themeGrid}>
            {THEME_OPTIONS.map((opt) => {
              const preview = THEMES[opt.id === 'system' ? 'light' : opt.id];
              const selected = theme === opt.id;
              return (
                <Pressable key={opt.id} onPress={() => setTheme(opt.id)} style={{ width: '31%' }}>
                  <View
                    style={[
                      styles.themeTile,
                      {
                        backgroundColor: preview.background,
                        borderColor: selected ? colors.primary : colors.border,
                        borderWidth: selected ? 3 : 1,
                      },
                    ]}>
                    <Emoji3D name={opt.emoji} size={34} float={selected} />
                    <View style={[styles.swatch, { backgroundColor: preview.heroGradient[0] }]} />
                    <Txt variant="caption" center color={preview.text} style={{ fontWeight: '800' }}>
                      {t(opt.label)}
                    </Txt>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Section>

        {/* Sounds */}
        <Card3D style={styles.row}>
          <Emoji3D name="bell" size={36} />
          <Txt style={{ flex: 1, fontWeight: '700' }}>{t('sounds')}</Txt>
          <Switch
            value={soundEnabled}
            onValueChange={setSoundEnabled}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor="#fff"
          />
        </Card3D>

        {/* How to use */}
        <Pressable onPress={() => router.push('/guide')}>
          <Card3D style={styles.row}>
            <Emoji3D name="clipboard" size={36} />
            <Txt style={{ flex: 1, fontWeight: '700' }}>{t('howToUse')}</Txt>
            <Emoji3D name="sparkles" size={26} />
          </Card3D>
        </Pressable>

        <Button3D title={t('signOut')} emoji="door" variant="secondary" onPress={signOut} />

        <Txt variant="caption" muted center>
          {"Kitchy's"} · {t('version')} {Constants.expoConfig?.version}
        </Txt>
      </ScrollView>
    </Screen>
  );
}

function Section({ emoji, title, children }: { emoji: EmojiName; title: string; children: React.ReactNode }) {
  return (
    <Card3D style={{ gap: 10 }}>
      <View style={styles.row}>
        <Emoji3D name={emoji} size={32} />
        <Txt variant="heading">{title}</Txt>
      </View>
      {children}
    </Card3D>
  );
}

function Option({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useSettings();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.option,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.surfaceAlt : 'transparent',
        },
      ]}>
      <Txt style={{ flex: 1, fontWeight: '700' }}>{label}</Txt>
      {selected && <Emoji3D name="check" size={24} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  option: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14, borderWidth: 1.5 },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  themeTile: { borderRadius: 16, padding: 10, alignItems: 'center', gap: 6 },
  swatch: { width: 28, height: 8, borderRadius: 4 },
});
