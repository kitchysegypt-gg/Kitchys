import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Emoji3D } from '@/components/Emoji3D';
import { PhotoPicker } from '@/components/PhotoPicker';
import { Button, Card, Chip, Icon, IconBadge, IconName, ScreenHeader, Txt } from '@/components/ui';
import { showAlert, showConfirm } from '@/lib/alert';
import { EMOJI, EmojiName } from '@/lib/emoji';
import type { TranslationKey } from '@/lib/i18n';
import { APPLIANCES, Appliance, PremiumInfo, ShopItem, usePremium } from '@/lib/premium';
import { useSettings } from '@/lib/settings';

const GOLD = '#B7791F';

/** Kitchen > Premium: Kitchy's Premium, the chef shop (points or monthly) and Kitchy's Care. */
export default function KitchenPremiumScreen() {
  const { t, colors } = useSettings();
  const premium = usePremium();
  const [refreshing, setRefreshing] = useState(false);
  const { info, items, loading } = premium;

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
          <ShopSection info={info} items={items} redeem={premium.redeem} />
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
  const { t, formatPrice, language } = useSettings();
  const [busy, setBusy] = useState(false);
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(language === 'ar' ? 'ar-EG' : language, { day: 'numeric', month: 'long' });
  const price = formatPrice(info.price);

  const benefits: { icon: IconName; text: string }[] = [
    { icon: 'trending-down', text: t('premiumBenefitCommission') },
    { icon: 'construct', text: t('premiumBenefitCare') },
    { icon: 'gift', text: t('premiumBenefitPoints') },
    { icon: 'card', text: t('premiumBenefitMonthly') },
    { icon: 'diamond', text: t('premiumBenefitBadge') },
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
    <LinearGradient colors={['#FFF6DD', '#FFE7B3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.plan}>
      <View style={styles.planHead}>
        <Emoji3D name="crown" size={52} />
        <View style={{ flex: 1 }}>
          <Txt style={styles.planTitle}>{t('premiumName')}</Txt>
          <Txt style={styles.planPrice}>{t('premiumPrice', { price })}</Txt>
        </View>
        {info.active && (
          <View style={[styles.activePill, { backgroundColor: GOLD }]}>
            <Icon name="diamond" size={12} color="#fff" />
            <Txt style={styles.activeText}>{t('premiumActive')}</Txt>
          </View>
        )}
      </View>

      <View style={{ gap: 10 }}>
        {benefits.map((b) => (
          <View key={b.icon} style={styles.benefit}>
            <View style={styles.benefitIcon}>
              <Icon name={b.icon} size={16} color={GOLD} />
            </View>
            <Txt style={styles.benefitText}>{b.text}</Txt>
          </View>
        ))}
      </View>

      {info.active ? (
        <View style={{ gap: 8 }}>
          <Txt style={styles.planNote}>
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
          <Txt style={styles.planNote}>{t('premiumSaveExample')}</Txt>
          <Button title={t('premiumJoin', { price })} icon="diamond" onPress={join} loading={busy} />
        </View>
      )}
    </LinearGradient>
  );
}

function ShopSection({
  info,
  items,
  redeem,
}: {
  info: PremiumInfo;
  items: ShopItem[];
  redeem: (itemId: string, method: 'points' | 'instalments') => Promise<void>;
}) {
  const { t, l, colors, formatPrice } = useSettings();
  const [busyId, setBusyId] = useState<string | null>(null);
  const openOrders = info.shop_orders.filter((o) => o.status === 'requested');

  const buy = (item: ShopItem, method: 'points' | 'instalments') => {
    const monthly = formatPrice(Math.ceil(item.price / 6));
    showConfirm(
      l(item.name),
      method === 'points'
        ? t('shopConfirmPoints', { points: item.points.toLocaleString() })
        : t('shopConfirmMonthly', { monthly, months: 6 }),
      {
        label: method === 'points' ? t('shopGetIt') : t('shopPayMonthly', { monthly }),
        cancelLabel: t('cancel'),
        onConfirm: () =>
          run(
            () => redeem(item.id, method),
            () => showAlert(t('shopRequestedTitle'), t('shopRequestedBody')),
            (b) => setBusyId(b ? item.id : null),
            t('error')
          ),
      }
    );
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.sectionHead}>
        <IconBadge name="storefront-outline" tone="orange" size={34} />
        <Txt variant="heading" style={{ flex: 1 }}>
          {t('shopTitle')}
        </Txt>
      </View>

      <Card style={styles.pointsCard}>
        <Emoji3D name="coin" size={44} />
        <View style={{ flex: 1 }}>
          <Txt variant="caption" muted>
            {t('shopYourPoints')}
          </Txt>
          <Txt style={styles.points}>{info.points.toLocaleString()}</Txt>
          <Txt variant="caption" muted>
            {info.points_multiplier > 1 ? t('shopEarnPremium') : t('shopEarnBasic')}
          </Txt>
        </View>
      </Card>

      {items.map((item) => {
        const progress = Math.min(1, info.points / item.points);
        const enough = info.points >= item.points;
        const emoji = (item.emoji in EMOJI ? item.emoji : 'pan') as EmojiName;
        return (
          <Card key={item.id} style={{ gap: 10 }}>
            <View style={styles.itemHead}>
              <View style={[styles.itemArt, { backgroundColor: colors.surfaceAlt }]}>
                <Emoji3D name={emoji} size={40} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt style={{ fontWeight: '800' }}>{l(item.name)}</Txt>
                <Txt variant="caption" muted>
                  {l(item.description)}
                </Txt>
              </View>
            </View>
            <View style={styles.itemPrices}>
              <Txt style={{ fontWeight: '800' }}>{t('shopPoints', { points: item.points.toLocaleString() })}</Txt>
              <Txt variant="caption" muted>
                {t('shopOrPrice', { price: formatPrice(item.price) })}
              </Txt>
            </View>
            <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
              <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: enough ? colors.success : GOLD }]} />
            </View>
            <View style={styles.actions}>
              <Button
                small
                title={enough ? t('shopGetIt') : t('shopPointsToGo', { n: (item.points - info.points).toLocaleString() })}
                icon={enough ? 'gift-outline' : undefined}
                onPress={() => buy(item, 'points')}
                disabled={!enough || busyId === item.id}
              />
              <Button
                small
                variant="secondary"
                icon={info.active ? 'card-outline' : 'lock-closed-outline'}
                title={t('shopPayMonthly', { monthly: formatPrice(Math.ceil(item.price / 6)) })}
                onPress={() => (info.active ? buy(item, 'instalments') : showAlert(t('premiumName'), t('shopMonthlyPremiumOnly')))}
                disabled={busyId === item.id}
              />
            </View>
          </Card>
        );
      })}

      {openOrders.length > 0 && (
        <Card style={{ gap: 8 }}>
          <Txt style={{ fontWeight: '700' }}>{t('shopOnTheWay')}</Txt>
          {openOrders.map((o) => {
            const item = items.find((i) => i.id === o.item_id);
            return (
              <View key={o.id} style={styles.requestRow}>
                <Icon name="time-outline" size={18} color={GOLD} />
                <Txt style={{ flex: 1 }}>{item ? l(item.name) : o.item_id}</Txt>
                <Txt variant="caption" muted>
                  {o.method === 'points'
                    ? t('shopPoints', { points: o.points_spent.toLocaleString() })
                    : t('shopMonthlyShort', { monthly: formatPrice(Number(o.monthly)), months: o.months ?? 6 })}
                </Txt>
              </View>
            );
          })}
        </Card>
      )}
    </View>
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
            <Icon name="lock-closed-outline" size={18} color={GOLD} />
            <Txt variant="caption" style={{ flex: 1, fontWeight: '600' }}>
              {t('careLocked')}
            </Txt>
          </View>
        ) : waiting ? (
          <View style={[styles.note, { backgroundColor: colors.surfaceAlt }]}>
            <Icon name="hourglass-outline" size={18} color={GOLD} />
            <Txt variant="caption" style={{ flex: 1, fontWeight: '600' }}>
              {t('careOpensOn', { date: date(opensAt!) })}
            </Txt>
          </View>
        ) : left === 0 ? (
          <View style={[styles.note, { backgroundColor: colors.surfaceAlt }]}>
            <Icon name="information-circle-outline" size={18} color={GOLD} />
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
                color={r.status === 'done' ? colors.success : r.status === 'cancelled' ? colors.danger : GOLD}
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
  plan: { borderRadius: 24, padding: 18, gap: 16, borderWidth: 1, borderColor: '#F2D48A' },
  planHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planTitle: { fontSize: 22, fontWeight: '800', color: '#3D2A00' },
  planPrice: { fontSize: 14, fontWeight: '700', color: GOLD },
  planNote: { fontSize: 13, color: '#5C4510', fontWeight: '600' },
  activePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  activeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  benefitIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#3D2A00' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pointsCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  points: { fontSize: 28, fontWeight: '800' },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemArt: { width: 60, height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  itemPrices: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  actions: { gap: 8 },
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { minHeight: 90, borderRadius: 14, borderWidth: 1, padding: 12, fontSize: 15, textAlignVertical: 'top' },
});
