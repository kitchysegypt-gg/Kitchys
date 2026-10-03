import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Share, StyleSheet, View } from 'react-native';

import { Button, Card, Icon, ListGroup, ListRow, Screen, ScreenHeader, Txt } from '@/components/ui';
import { useOrders } from '@/lib/orders';
import { useReferrals } from '@/lib/referrals';
import { useSettings } from '@/lib/settings';

export default function ReferScreen() {
  const { t, colors, formatPrice, language } = useSettings();
  const { credit } = useOrders();
  const { code, referrals, error } = useReferrals();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const share = () => {
    if (!code) return;
    Share.share({ message: t('shareMessage', { code }) }).catch(() => {});
  };

  const locale = language === 'ar' ? 'ar-EG' : language;

  return (
    <Screen>
      <ScreenHeader title={t('referFriend')} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 18, paddingBottom: 40 }}>
        <View style={styles.intro}>
          <View style={[styles.introIcon, { backgroundColor: colors.surfaceAlt }]}>
            <Icon name="gift-outline" size={34} color={colors.primary} />
          </View>
          <Txt variant="title" center style={{ fontSize: 22 }}>
            {t('referTitle')}
          </Txt>
          <Txt muted center>
            {t('referBody')}
          </Txt>
        </View>

        <Card style={{ gap: 14, alignItems: 'center', paddingVertical: 20 }}>
          <Txt variant="label" muted>
            {t('yourCode')}
          </Txt>
          <View style={[styles.code, { borderColor: colors.primary, backgroundColor: colors.surfaceAlt }]}>
            {code ? (
              <Txt selectable style={styles.codeText} color={colors.primary}>
                {code}
              </Txt>
            ) : error ? (
              <Txt muted>{error}</Txt>
            ) : (
              <ActivityIndicator color={colors.primary} />
            )}
          </View>
          <View style={styles.buttons}>
            <Button
              small
              variant="secondary"
              icon={copied ? 'checkmark' : 'copy-outline'}
              title={copied ? t('copied') : t('copyCode')}
              onPress={copy}
              disabled={!code}
              style={{ flex: 1 }}
            />
            <Button small icon="share-social-outline" title={t('shareCode')} onPress={share} disabled={!code} style={{ flex: 1 }} />
          </View>
        </Card>

        <Card style={styles.creditCard}>
          <View style={[styles.creditIcon, { backgroundColor: colors.successBg }]}>
            <Icon name="wallet-outline" size={24} color={colors.success} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="caption" muted>
              {t('yourCredit')}
            </Txt>
            <Txt style={{ fontSize: 22, fontWeight: '800', color: colors.success }}>{formatPrice(credit)}</Txt>
            <Txt variant="caption" muted>
              {t('creditBody')}
            </Txt>
          </View>
        </Card>

        <ListGroup title={t('friendsReferred')}>
          {referrals.length === 0 ? (
            <View style={{ padding: 16 }}>
              <Txt muted>{t('noReferrals')}</Txt>
            </View>
          ) : (
            referrals.map((r) => (
              <ListRow
                key={r.id}
                icon="person-outline"
                label={r.friend_name || t('friend')}
                detail={new Date(r.created_at).toLocaleDateString(locale, { dateStyle: 'medium' })}
                right={
                  <Txt
                    style={{
                      fontWeight: '700',
                      color: r.status === 'cancelled' ? colors.textMuted : colors.success,
                      textDecorationLine: r.status === 'cancelled' ? 'line-through' : 'none',
                    }}>
                    {r.status === 'cancelled' ? t('cancelledShort') : `+${formatPrice(r.cashback)}`}
                  </Txt>
                }
              />
            ))
          )}
        </ListGroup>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingTop: 8 },
  introIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  code: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  codeText: { fontSize: 28, fontWeight: '800', letterSpacing: 4 },
  buttons: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  creditCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  creditIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
