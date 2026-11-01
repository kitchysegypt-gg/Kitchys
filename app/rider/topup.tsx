import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Button, Card, Chip, Screen, ScreenHeader, Txt } from '@/components/ui';
import { showAlert } from '@/lib/alert';
import { FONT } from '@/lib/fonts';
import type { TranslationKey } from '@/lib/i18n';
import { RiderTopup, useRider } from '@/lib/rider';
import { useSettings } from '@/lib/settings';

/**
 * Rider > Top up: send money to Kitchy's by InstaPay or Vodafone Cash, then type the amount and
 * the transfer reference. The team checks it and adds it to the balance.
 */
export default function RiderTopupScreen() {
  const { t, colors, formatPrice, isRTL } = useSettings();
  const { balance, topups, topupDetails, requestTopup } = useRider();
  const [method, setMethod] = useState<RiderTopup['method']>(topupDetails.instapay || !topupDetails.vodafoneCash ? 'instapay' : 'vodafone_cash');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);

  const sendTo = method === 'instapay' ? topupDetails.instapay : topupDetails.vodafoneCash;
  const value = Number(amount.replace(/[^0-9.]/g, ''));
  const ready = value >= 50 && reference.trim().length >= 3;

  const send = async () => {
    setBusy(true);
    try {
      await requestTopup(value, method, reference.trim());
      setAmount('');
      setReference('');
      showAlert(t('riderTopupSent'));
      router.back();
    } catch (e: any) {
      showAlert(t('error'), e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const input = [
    styles.input,
    { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, textAlign: isRTL ? 'right' : 'left' } as const,
  ];

  return (
    <Screen>
      <ScreenHeader title={t('riderTopupTitle')} onBack={() => router.back()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Card style={{ gap: 4 }}>
            <Txt variant="caption" muted>
              {t('riderBalance')}
            </Txt>
            <Txt style={{ fontSize: 28, fontWeight: '800' }}>{formatPrice(balance)}</Txt>
          </Card>

          <Txt muted>{t('riderTopupHow')}</Txt>

          <Txt variant="label" muted>
            {t('riderTopupMethod')}
          </Txt>
          <View style={styles.row}>
            <Chip label={t('methodInstapay')} active={method === 'instapay'} onPress={() => setMethod('instapay')} />
            <Chip label={t('methodVodafoneCash')} active={method === 'vodafone_cash'} onPress={() => setMethod('vodafone_cash')} />
          </View>

          <Card style={{ gap: 4, borderColor: colors.primary, borderWidth: 1 }}>
            <Txt variant="caption" muted>
              {t('riderTopupSendTo')}
            </Txt>
            {sendTo ? (
              <Txt selectable style={{ fontSize: 20, fontWeight: '800' }}>
                {sendTo}
              </Txt>
            ) : (
              <Txt style={{ fontWeight: '600' }}>{t('riderTopupNoDetails')}</Txt>
            )}
          </Card>

          <Txt variant="label" muted>
            {t('riderTopupAmount')}
          </Txt>
          <TextInput value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="500" placeholderTextColor={colors.textMuted} style={input} />

          <Txt variant="label" muted>
            {t('riderTopupRef')}
          </Txt>
          <TextInput
            value={reference}
            onChangeText={setReference}
            autoCapitalize="characters"
            placeholder={t('riderTopupRefHint')}
            placeholderTextColor={colors.textMuted}
            style={input}
          />

          <Button title={t('riderTopupSend')} icon="paper-plane-outline" onPress={send} loading={busy} disabled={!ready} />

          {topups.length > 0 && (
            <>
              <Txt variant="label" muted style={{ marginTop: 8 }}>
                {t('riderTopupRecent')}
              </Txt>
              <Card style={{ gap: 2 }}>
                {topups.map((topup) => (
                  <View key={topup.id} style={[styles.topupRow, { borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Txt style={{ fontWeight: '700' }}>{formatPrice(topup.amount)}</Txt>
                      <Txt variant="caption" muted numberOfLines={1}>
                        {topup.method === 'instapay' ? t('methodInstapay') : t('methodVodafoneCash')} · {topup.reference}
                      </Txt>
                    </View>
                    <Txt
                      style={{
                        fontWeight: '700',
                        color: topup.status === 'approved' ? colors.success : topup.status === 'rejected' ? colors.danger : colors.textMuted,
                      }}>
                      {t(`riderTopupStatus_${topup.status}` as TranslationKey)}
                    </Txt>
                  </View>
                ))}
              </Card>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontFamily: FONT.regular, fontSize: 16 },
  topupRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});
