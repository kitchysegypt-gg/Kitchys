import Constants from 'expo-constants';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Icon, IconName, ListGroup, ListRow, Screen, ScreenHeader, Txt } from '@/components/ui';
import { useCart } from '@/lib/cart';
import { LANGUAGES } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { ACCENTS, AccentName, THEMES, ThemePreference } from '@/lib/theme';
import { supabase } from '@/lib/supabase';

const THEME_OPTIONS: {
  id: ThemePreference;
  icon: IconName;
  label: 'themeSystem' | 'themeLight' | 'themeDark' | 'themeSunset' | 'themeMint';
}[] = [
  { id: 'system', icon: 'phone-portrait-outline', label: 'themeSystem' },
  { id: 'light', icon: 'sunny-outline', label: 'themeLight' },
  { id: 'dark', icon: 'moon-outline', label: 'themeDark' },
  { id: 'sunset', icon: 'flower-outline', label: 'themeSunset' },
  { id: 'mint', icon: 'leaf-outline', label: 'themeMint' },
];

export default function SettingsScreen() {
  const { t, colors, language, setLanguage, theme, setTheme, soundEnabled, setSoundEnabled, accent, setAccent } =
    useSettings();
  const { clear } = useCart();

  const signOut = async () => {
    clear();
    await supabase.auth.signOut();
  };

  const check = <Icon name="checkmark" size={22} color={colors.primary} />;

  return (
    <Screen>
      <ScreenHeader title={t('settings')} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 22, paddingBottom: 40 }}>
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

        <ListGroup title={t('theme')}>
          {THEME_OPTIONS.map((opt) => {
            const preview = THEMES[opt.id === 'system' ? 'light' : opt.id];
            return (
              <ListRow
                key={opt.id}
                icon={opt.icon}
                label={t(opt.label)}
                onPress={() => setTheme(opt.id)}
                right={
                  <View style={styles.themeRight}>
                    <View style={[styles.preview, { backgroundColor: preview.background, borderColor: colors.border }]}>
                      <View style={[styles.previewDot, { backgroundColor: preview.heroGradient[0] }]} />
                    </View>
                    {theme === opt.id ? check : <View style={{ width: 22 }} />}
                  </View>
                }
              />
            );
          })}
        </ListGroup>

        <ListGroup title={t('accentColor')}>
          <View style={styles.accentRow}>
            {(Object.keys(ACCENTS) as AccentName[]).map((name) => {
              const selected = accent === name;
              return (
                <Pressable
                  key={name}
                  onPress={() => setAccent(name)}
                  accessibilityLabel={t(`ac_${name}`)}
                  style={styles.accentItem}>
                  <View
                    style={[
                      styles.swatch,
                      { backgroundColor: ACCENTS[name].primary, borderColor: selected ? colors.text : 'transparent' },
                    ]}>
                    {selected && <Icon name="checkmark" size={20} color="#fff" />}
                  </View>
                  <Txt variant="caption" center muted={!selected} style={{ fontWeight: selected ? '700' : '500' }}>
                    {t(`ac_${name}`)}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
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
          <ListRow icon="log-out-outline" label={t('signOut')} onPress={signOut} color={colors.danger} right={<View />} />
        </ListGroup>

        <Txt variant="caption" muted center>
          {"Kitchy's"} · {t('version')} {Constants.expoConfig?.version}
        </Txt>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  themeRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  preview: { width: 34, height: 22, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  previewDot: { width: 12, height: 12, borderRadius: 6 },
  accentRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 12 },
  accentItem: { alignItems: 'center', gap: 6, width: 50 },
  swatch: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
