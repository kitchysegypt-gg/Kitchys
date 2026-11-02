import { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, TextInput, View } from 'react-native';

import { Button, Card, Txt } from '@/components/ui';
import { showAlert, showConfirm } from '@/lib/alert';
import { FONT } from '@/lib/fonts';
import { useSettings } from '@/lib/settings';
import { supabase } from '@/lib/supabase';

type PendingTopup = {
  id: string;
  amount: number;
  method: 'instapay' | 'vodafone_cash';
  reference: string;
  created_at: string;
  rider: { name: string; phone: string; balance: number };
};

/**
 * Admin: riders' top-ups waiting for a check ("Money arrived" adds it to their balance), and
 * where riders send the money (shown on their top-up screen).
 */
export function AdminRiderTopups({ refreshKey }: { refreshKey: number }) {
  const { t, colors, formatPrice, isRTL } = useSettings();
  const [topups, setTopups] = useState<PendingTopup[] | null>(null);
  const [instapay, setInstapay] = useState('');
  const [vodafone, setVodafone] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [list, config] = await Promise.all([
      supabase.rpc('admin_rider_topups'),
      supabase.from('app_config').select('key, value').in('key', ['rider_topup_instapay', 'rider_topup_vodafone_cash']),
    ]);
    if (!list.error) setTopups((list.data ?? []) as PendingTopup[]);
    if (!config.error) {
      setInstapay(config.data?.find((r) => r.key === 'rider_topup_instapay')?.value ?? '');
      setVodafone(config.data?.find((r) => r.key === 'rider_topup_vodafone_cash')?.value ?? '');
    }
  }, []);

  useEffect(() => {
    // Loads after the render (the list arrives from the network anyway).
    Promise.resolve().then(load);
  }, [load, refreshKey]);

  const review = async (topup: PendingTopup, approve: boolean) => {
    setBusy(topup.id + approve);
    try {
      const { error } = await supabase.rpc('review_rider_topup', { p_id: topup.id, p_approve: approve });
      if (error) throw error;
      await load();
    } catch (e: any) {
      showAlert(t('error'), e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  };

  const saveDetails = async () => {
    setBusy('details');
    try {
      for (const [key, value] of [
        ['rider_topup_instapay', instapay],
        ['rider_topup_vodafone_cash', vodafone],
      ] as const) {
        const { error } = await supabase.rpc('set_app_config', { p_key: key, p_value: value });
        if (error) throw error;
      }
      showAlert(t('adminSaved'));
    } catch (e: any) {
      showAlert(t('error'), e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  };

  const input = [styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text, textAlign: isRTL ? 'right' : 'left' } as const];

  return (
    <>
      <Txt variant="label" muted style={styles.section}>
        {t('adminTopups')}
        {topups?.length ? ` (${topups.length})` : ''}
      </Txt>
      {topups && topups.length === 0 && <Txt muted>{t('adminTopupsEmpty')}</Txt>}
      {topups?.map((topup) => (
        <Card key={topup.id} style={{ gap: 8 }}>
          <View style={styles.row}>
            <Txt style={{ fontWeight: '800', fontSize: 18, flex: 1 }}>{formatPrice(Number(topup.amount))}</Txt>
            <Txt style={{ fontWeight: '700', color: colors.primary }}>
              {topup.method === 'instapay' ? t('methodInstapay') : t('methodVodafoneCash')}
            </Txt>
          </View>
          <Txt selectable>
            {t('riderTopupRef')}: <Txt style={{ fontWeight: '700' }}>{topup.reference}</Txt>
          </Txt>
          <Txt variant="caption" muted onPress={() => Linking.openURL(`tel:${topup.rider.phone}`)}>
            {t('adminTopupRider', {
              name: topup.rider.name,
              phone: topup.rider.phone,
              balance: formatPrice(Number(topup.rider.balance)),
            })}
          </Txt>
          <View style={styles.row}>
            <Button
              small
              title={t('adminTopupApprove')}
              icon="checkmark"
              onPress={() => review(topup, true)}
              loading={busy === topup.id + true}
              style={{ flex: 1 }}
            />
            <Button
              small
              variant="secondary"
              title={t('adminTopupReject')}
              icon="close"
              onPress={() =>
                showConfirm(t('adminTopupReject'), t('adminTopupRejectBody'), {
                  label: t('adminTopupReject'),
                  cancelLabel: t('cancel'),
                  onConfirm: () => review(topup, false),
                })
              }
              loading={busy === topup.id + false}
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      ))}

      <Txt variant="label" muted style={styles.section}>
        {t('adminTopupDetails')}
      </Txt>
      <Card style={{ gap: 8 }}>
        <Txt variant="caption" muted>
          {t('adminInstapayLabel')}
        </Txt>
        <TextInput value={instapay} onChangeText={setInstapay} autoCapitalize="none" style={input} />
        <Txt variant="caption" muted>
          {t('adminVodafoneLabel')}
        </Txt>
        <TextInput value={vodafone} onChangeText={setVodafone} keyboardType="phone-pad" style={input} />
        <Button small title={t('adminSave')} onPress={saveDetails} loading={busy === 'details'} />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontFamily: FONT.regular, fontSize: 15 },
});
