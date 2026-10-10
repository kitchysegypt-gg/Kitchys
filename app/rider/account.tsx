import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from '@/components/Logo';
import { Button, Card, Chip, Icon, Txt } from '@/components/ui';
import type { Language } from '@/lib/i18n';
import { riderSignOut, useRider } from '@/lib/rider';
import { useSettings } from '@/lib/settings';

const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'ar', label: 'العربية' },
  { id: 'en', label: 'English' },
  { id: 'fr', label: 'Français' },
];

/** Rider > Account: the rider's details, language and sign out. */
export default function RiderAccountScreen() {
  const { t, colors, language, setLanguage } = useSettings();
  const { rider } = useRider();

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Logo width={90} />
          <Txt variant="heading" style={{ color: colors.primary }}>
            {t('riderAppName')}
          </Txt>
        </View>

        {rider && (
          <Card style={{ gap: 10 }}>
            <Row icon="person-outline" text={rider.name} />
            <Row icon="call-outline" text={rider.phone} />
            <Row icon="bicycle-outline" text={t(`vehicle_${rider.vehicle}`)} />
            {rider.area ? <Row icon="location-outline" text={rider.area} /> : null}
          </Card>
        )}

        <Card style={{ gap: 10 }}>
          <Txt style={{ fontWeight: '700' }}>{t('language')}</Txt>
          <View style={styles.chips}>
            {LANGUAGES.map((l) => (
              <Chip key={l.id} label={l.label} active={language === l.id} onPress={() => setLanguage(l.id)} />
            ))}
          </View>
        </Card>

        <Button title={t('signOut')} variant="ghost" icon="log-out-outline" onPress={riderSignOut} />
      </ScrollView>
    </SafeAreaView>
  );

  function Row({ icon, text }: { icon: 'person-outline' | 'call-outline' | 'bicycle-outline' | 'location-outline'; text: string }) {
    return (
      <View style={styles.row}>
        <Icon name={icon} size={20} color={colors.textMuted} />
        <Txt style={{ flex: 1 }}>{text}</Txt>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
