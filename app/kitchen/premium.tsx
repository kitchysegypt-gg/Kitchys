import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PhotoPicker } from '@/components/PhotoPicker';
import { Button, Card, Chip, Icon, IconBadge, IconName, ScreenHeader, Txt } from '@/components/ui';
import { showAlert, showConfirm } from '@/lib/alert';
import type { TranslationKey } from '@/lib/i18n';
import { APPLIANCES, Appliance, PremiumInfo, usePremium } from '@/lib/premium';
import { useSettings } from '@/lib/settings';

/** Kitchen > Premium: Kitchy's Premium (12% commission, Kitchy's Care, badge) and Kitchy's Care requests. */
export default function KitchenPremiumScreen() {
  const { t, colors } = useSettings();
  const premium = usePremium();
  const [refreshing, setRefreshing] = useState(false);
  const { info, loading } = premium;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t('premiumTitle')} />
      {loading || !info ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 16, paddingBottom: 48 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await premium.refresh();
                setRefreshing(false);
              }}
              tintColor={colors.primary}
            />
          }>
          <PlanCard info={info} subscribe={premium.subscribe} cancel={premium.cancel} />
          <CareSection info={info} requestCare={premium.requestCare} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const run = async (action: () => Promise<void>, done: () => void, setBusy: (b: boolean) => void, errorTitle: string) => {
  setBusy(true);
  try {
    await action();
    done();
  } catch (e: any) {
    showAlert(errorTitle, e?.message ?? String(e));
  } finally {
    setBusy(false);
  }
};

function PlanCard({ info, subscribe, cancel }: { info: PremiumInfo; subscribe: () => Promise<void>; cancel: () => Promise<void> }) {
  const { t, colors, formatPrice, language } = useSettings();
  const [busy, setBusy] = useState(false);
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(language === 'ar' ? 'ar-EG' : language, { day: 'numeric', month: 'long' });
  const price = formatPrice(info.price);

  const benefits: { icon: IconName; text: string }[] = [
    { icon: 'trending-down-outline', text: t('premiumBenefitCommission') },
    { icon: 'construct-outline', text: t('premiumBenefitCare') },
    { icon: 'ribbon-outline', text: t('premiumBenefitBadge') },
  ];

  const join = () =>
    showConfirm(t('premiumJoinTitle'), t('premiumJoinBody', { price }), {
      label: t('premiumJoin', { price }),
      cancelLabel: t('cancel'),
      onConfirm: () => run(subscribe, () => showAlert(t('premiumWelcomeTitle'), t('premiumWelcomeBody')), setBusy, t('error')),
    });

  const stop = () =>
    showConfirm(t('premiumCancelTitle'), t('premiumCancelBody', { date: date(info.period_end!) }), {
      label: t('premiumCancel'),
      cancelLabel: t('premiumKeep'),
      onConfirm: () => run(cancel, () => null, setBusy, t('error')),
    });

  return (
    <Card style={{ gap: 16 }}>
      <View style={styles.planHead}>
        <IconBadge name="diamond-outline" tone="amber" size={48} solid />
        <View style={{ flex: 1 }}>
          <Txt variant="heading">{t('premiumName')}</Txt>
          <Txt variant="caption" muted>
            {t('premiumPrice', { price })}
          </Txt>
        </View>
        {info.active && (
          <View style={[styles.activePill, { backgroundColor: colors.success }]}>
            <Txt style={styles.activeText}>{t('premiumActive')}</Txt>
          </View>
        )}
      </View>

      <View style={{ gap: 10 }}>
        {benefits.map((b) => (
          <View key={b.icon} style={styles.benefit}>
            <Icon name={b.icon} size={20} color={colors.primary} />
            <Txt style={{ flex: 1, fontWeight: '600' }}>{b.text}</Txt>
          </View>
        ))}
      </View>

      {info.active ? (
        <View style={{ gap: 8 }}>
          <Txt variant="caption" muted>
            {info.cancel_at_period_end
              ? t('premiumEndsOn', { date: date(info.period_end!) })
              : t('premiumRenewsOn', { date: date(info.period_end!), price })}
          </Txt>
          {info.cancel_at_period_end ? (
            <Button title={t('premiumResume')} icon="refresh" onPress={() => run(subscribe, () => null, setBusy, t('error'))} loading={busy} />
          ) : (
            <Button title={t('premiumCancel')} variant="ghost" small onPress={stop} disabled={busy} />
          )}
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <Txt variant="caption" muted>
            {t('premiumSaveExample')}
          </Txt>
          <Button title={t('premiumJoin', { price })} onPress={join} loading={busy} />
        </View>
      )}
    </Card>
  );
}

function CareSection({
  info,
  requestCare,
}: {
  info: PremiumInfo;
  requestCare: (appliance: Appliance, problem: string, photo: string | null) => Promise<void>;
}) {
  const { t, colors, language } = useSettings();
  const [appliance, setAppliance] = useState<Appliance | null>(null);
  const [problem, setProblem] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => Date.now());
  const left = Math.max(0, info.care_limit - info.care_used);
  const opensAt = info.care_from ? new Date(info.care_from) : null;
  const waiting = !!opensAt && opensAt.getTime() > now;
  const date = (d: Date) => d.toLocaleDateString(language === 'ar' ? 'ar-EG' : language, { day: 'numeric', month: 'long' });

  const send = () => {
    if (!appliance) return showAlert(t('careTitle'), t('carePickAppliance'));
    if (problem.trim().length < 10) return showAlert(t('careTitle'), t('careDescribe'));
    run(
      () => requestCare(appliance, problem.trim(), photo),
      () => {
        setAppliance(null);
        setProblem('');
        setPhoto(null);
        showAlert(t('careSentTitle'), t('careSentBody'));
      },
      setBusy,
      t('error')
    );
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.sectionHead}>
        <IconBadge name="construct-outline" tone="blue" size={34} />
        <Txt variant="heading" style={{ flex: 1 }}>
          {t('careTitle')}
        </Txt>
      </View>

      <Card style={{ gap: 12 }}>
        <Txt variant="caption" muted>
          {t('careIntro')}
        </Txt>
        {!info.active ? (
          <View style={[styles.note, { backgroundColor: colors.surfaceAlt }]}>
            <Icon name="lock-closed-outline" size={18} color={colors.primary} />
            <Txt variant="caption" style={{ flex: 1, fontWeight: '600' }}>
              {t('careLocked')}
            </Txt>
          </View>
        ) : waiting ? (
          <View style={[styles.note, { backgroundColor: colors.surfaceAlt }]}>
            <Icon name="hourglass-outline" size={18} color={colors.primary} />
            <Txt variant="caption" style={{ flex: 1, fontWeight: '600' }}>
              {t('careOpensOn', { date: date(opensAt!) })}
            </Txt>
          </View>
        ) : left === 0 ? (
          <View style={[styles.note, { backgroundColor: colors.surfaceAlt }]}>
            <Icon name="information-circle-outline" size={18} color={colors.primary} />
            <Txt variant="caption" style={{ flex: 1, fontWeight: '600' }}>
              {t('careUsedUp')}
            </Txt>
          </View>
        ) : (
          <>
            <Txt style={{ fontWeight: '700' }}>{t('careVisitsLeft', { n: left, limit: info.care_limit })}</Txt>
            <View style={styles.chips}>
              {APPLIANCES.map((a) => (
                <Chip
                  key={a}
                  label={t(`appliance_${a}` as TranslationKey)}
                  active={appliance === a}
                  onPress={() => setAppliance(a)}
                />
              ))}
            </View>
            <TextInput
              value={problem}
              onChangeText={setProblem}
              placeholder={t('careProblemPlaceholder')}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={1000}
              style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
            />
            <PhotoPicker value={photo} onChange={setPhoto} label={t('carePhoto')} />
            <Button title={t('careSend')} icon="construct-outline" onPress={send} loading={busy} />
          </>
        )}
      </Card>

      {info.care_requests.length > 0 && (
        <Card style={{ gap: 8 }}>
          {info.care_requests.map((r) => (
            <View key={r.id} style={styles.requestRow}>
              <Icon
                name={r.status === 'done' ? 'checkmark-circle' : r.status === 'cancelled' ? 'close-circle' : 'time-outline'}
                size={18}
                color={r.status === 'done' ? colors.success : r.status === 'cancelled' ? colors.danger : colors.primary}
              />
              <View style={{ flex: 1 }}>
                <Txt style={{ fontWeight: '600' }}>{t(`appliance_${r.appliance}` as TranslationKey)}</Txt>
                <Txt variant="caption" muted numberOfLines={1}>
                  {r.problem}
                </Txt>
              </View>
              <Txt variant="caption" muted>
                {t(`careStatus_${r.status}` as TranslationKey)}
              </Txt>
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  planHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  activePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  activeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { minHeight: 90, borderRadius: 14, borderWidth: 1, padding: 12, fontSize: 15, textAlignVertical: 'top' },
});
