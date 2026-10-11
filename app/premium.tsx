import { Image } from 'expo-image';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, Icon, IconName, Screen, ScreenHeader, Txt } from '@/components/ui';
import { showAlert, showConfirm } from '@/lib/alert';
import { useMembership } from '@/lib/membership';
import { useSettings } from '@/lib/settings';
import { FONT } from '@/lib/fonts';

const BANNER = require('@/assets/photos/premium.jpg');

/** Kitchy's Premium for customers: free delivery and Tonight's dinner for EGP 149 a month. */
export default function PremiumScreen() {
  const { t, colors, formatPrice, language } = useSettings();
  const { membership, isMember, join, cancel } = useMembership();
  const [busy, setBusy] = useState(false);
  const price = formatPrice(membership?.price ?? 149);
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(language === 'ar' ? 'ar-EG' : language, { day: 'numeric', month: 'long' });

  const run = async (action: () => Promise<void>, done?: () => void) => {
    setBusy(true);
    try {
      await action();
      done?.();
    } catch (e: any) {
      showAlert(t('error'), e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const perks: { icon: IconName; title: string; body: string }[] = [
    { icon: 'restaurant-outline', title: t('memberPerkTonight'), body: t('memberPerkTonightBody') },
    { icon: 'bicycle-outline', title: t('memberPerkDelivery'), body: t('memberPerkDeliveryBody') },
  ];

  const onJoin = () =>
    showConfirm(t('memberJoinTitle'), t('memberJoinBody', { price }), {
      label: t('memberJoin', { price }),
      cancelLabel: t('cancel'),
      onConfirm: () => run(join, () => showAlert(t('memberWelcomeTitle'), t('memberWelcomeBody', { price }))),
    });

  const onCancel = () =>
    showConfirm(t('memberCancelTitle'), t('memberCancelBody', { date: date(membership!.period_end!) }), {
      label: t('memberCancel'),
      cancelLabel: t('memberKeep'),
      onConfirm: () => run(cancel),
    });

  return (
    <Screen>
      <ScreenHeader title={t('premiumName')} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={[styles.banner, { backgroundColor: colors.surfaceAlt }]}>
          <Image source={BANNER} style={StyleSheet.absoluteFill} contentFit="cover" />
        </View>

        <View style={{ padding: 16, gap: 14 }}>
          <View style={{ gap: 4 }}>
            <Txt variant="caption" muted style={styles.kicker}>
              {t('memberKicker')}
            </Txt>
            <Txt style={[styles.title, { color: colors.primary }]}>{t('memberTitle')}</Txt>
            <Txt muted>{t('memberTagline')}</Txt>
          </View>

          <Card style={{ gap: 14 }}>
            {perks.map((p) => (
              <View key={p.icon} style={styles.perk}>
                <View style={[styles.perkIcon, { backgroundColor: colors.primary }]}>
                  <Icon name={p.icon} size={20} color={colors.onPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontWeight: '700' }}>{p.title}</Txt>
                  <Txt variant="caption" muted>
                    {p.body}
                  </Txt>
                </View>
              </View>
            ))}
          </Card>

          {isMember && membership?.period_end ? (
            <Card style={{ gap: 10 }}>
              <View style={styles.perk}>
                <Icon name="checkmark-circle" size={22} color={colors.success} />
                <Txt style={{ flex: 1, fontWeight: '700' }}>{t('memberActive')}</Txt>
              </View>
              <Txt variant="caption" muted>
                {membership.cancel_at_period_end
                  ? t('memberEndsOn', { date: date(membership.period_end) })
                  : membership.pending_fee > 0
                    ? t('memberFeeNextOrder', { price: formatPrice(membership.pending_fee) })
                    : t('memberRenewsOn', { date: date(membership.period_end), price })}
              </Txt>
              {membership.cancel_at_period_end ? (
                <Button title={t('memberResume')} onPress={() => run(join)} loading={busy} />
              ) : (
                <Button title={t('memberCancel')} variant="ghost" small onPress={onCancel} disabled={busy} />
              )}
            </Card>
          ) : (
            <View style={{ gap: 8 }}>
              <Button title={t('memberJoin', { price })} icon="arrow-forward" onPress={onJoin} loading={busy} />
              <Txt variant="caption" muted center>
                {t('memberHowPay', { price })}
              </Txt>
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: { height: 260, overflow: 'hidden' },
  kicker: { letterSpacing: 2, textTransform: 'uppercase', fontWeight: '700' },
  title: { fontFamily: FONT.extrabold, fontSize: 32, lineHeight: 38 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  perkIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
