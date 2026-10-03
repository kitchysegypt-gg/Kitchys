import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Modal, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Confetti } from '@/components/Confetti';
import { Button, Card, Icon, Screen, ScreenHeader, Txt } from '@/components/ui';
import { showAlert } from '@/lib/alert';
import { EGP_PER_POINT, RANKS, REWARDS, Reward, getReward } from '@/lib/loyalty';
import { useOrders } from '@/lib/orders';
import { useSettings } from '@/lib/settings';
import { useSounds } from '@/lib/sound';

export default function RewardsScreen() {
  const { t, colors } = useSettings();
  const { points, rank, next, orderCount, availableVouchers, redeem, refresh, loading } = useOrders();
  const { playOrderSuccess } = useSounds();
  const [confirming, setConfirming] = useState<Reward | null>(null);
  const [busy, setBusy] = useState(false);
  const [burst, setBurst] = useState(0);

  const progress = next ? (orderCount - rank.minOrders) / (next.minOrders - rank.minOrders) : 1;

  const onRedeem = async () => {
    if (!confirming) return;
    setBusy(true);
    try {
      await redeem(confirming.id);
      setConfirming(null);
      setBurst(Date.now());
      playOrderSuccess();
      showAlert(t('voucherAdded'));
    } catch (e: any) {
      showAlert(t('error'), e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title={t('tabRewards')} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}>
        <LinearGradient colors={colors.heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={[styles.rankBadge, { backgroundColor: rank.color }]}>
              <Icon name={rank.icon} size={30} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="label" color="rgba(255,255,255,0.85)">
                {t('rank')}
              </Txt>
              <Txt variant="title" color="#fff">
                {t(`rank_${rank.id}`)}
              </Txt>
              <Txt variant="caption" color="#fff" style={{ fontWeight: '700' }}>
                {t('pointsBoost')} ×{rank.multiplier}
              </Txt>
            </View>
            <View style={styles.pointsBubble}>
              <Txt variant="heading" color="#1B1B1F" center style={styles.tabular}>
                {points}
              </Txt>
              <Txt variant="caption" color="#5B4F48" center>
                {t('pts')}
              </Txt>
            </View>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(4, Math.min(100, progress * 100))}%` }]} />
          </View>
          <Txt variant="caption" color="#fff" style={{ fontWeight: '700' }}>
            {next ? t('rankProgress', { n: next.minOrders - orderCount, rank: t(`rank_${next.id}`) }) : t('topRank')}
          </Txt>
        </LinearGradient>

        <Card style={styles.row}>
          <Icon name="information-circle-outline" size={24} color={colors.primary} />
          <Txt style={{ flex: 1, fontWeight: '500' }}>{t('earnRule')}</Txt>
        </Card>

        {/* Vouchers the customer already owns */}
        <View style={styles.sectionTitle}>
          <Txt variant="heading">{t('myVouchers')}</Txt>
        </View>
        {availableVouchers.length === 0 ? (
          <Txt muted>{t('noVouchers')}</Txt>
        ) : (
          <View style={{ gap: 10 }}>
            {availableVouchers.map((v) => {
              const reward = getReward(v.reward_id);
              return (
                <View
                  key={v.id}
                  style={[styles.voucher, { borderColor: colors.primary, backgroundColor: colors.surface }]}>
                  <Icon name={reward?.icon ?? 'pricetags'} size={26} color={colors.primary} />
                  <Txt style={{ flex: 1, fontWeight: '600' }}>{reward ? t(reward.label) : v.reward_id}</Txt>
                </View>
              );
            })}
          </View>
        )}

        {/* Catalogue */}
        <View style={styles.sectionTitle}>
          <Txt variant="heading">{t('rewards')}</Txt>
        </View>
        <View style={{ gap: 12 }}>
          {REWARDS.map((reward) => {
            const locked = rank.level < reward.minRank;
            const short = reward.cost - points;
            const lockedRank = RANKS[reward.minRank];
            return (
              <Card key={reward.id} style={[styles.row, locked && { opacity: 0.6 }]}>
                <View style={[styles.rewardArt, { backgroundColor: colors.surfaceAlt }]}>
                  <Icon name={locked ? 'lock-closed-outline' : reward.icon} size={26} color={colors.primary} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt style={{ fontWeight: '700' }}>{t(reward.label)}</Txt>
                  <View style={styles.costRow}>
                    <Txt variant="caption" style={[{ fontWeight: '700', color: colors.primary }, styles.tabular]}>
                      {reward.cost} {t('pts')}
                    </Txt>
                  </View>
                  {locked ? (
                    <Txt variant="caption" muted>
                      {t('unlocksAt', { rank: t(`rank_${lockedRank.id}`) })}
                    </Txt>
                  ) : short > 0 ? (
                    <Txt variant="caption" muted>
                      {t('needMorePoints', { n: short })}
                    </Txt>
                  ) : null}
                </View>
                <Button
                  small
                  title={t('redeem')}
                  disabled={locked || short > 0}
                  onPress={() => setConfirming(reward)}
                />
              </Card>
            );
          })}
        </View>

        {/* Rank ladder */}
        <View style={styles.sectionTitle}>
          <Txt variant="heading">{t('ranks')}</Txt>
        </View>
        <Card style={{ gap: 4, paddingVertical: 8 }}>
          {RANKS.map((r) => {
            const current = r.id === rank.id;
            return (
              <View
                key={r.id}
                style={[styles.rankRow, current && { backgroundColor: colors.surfaceAlt }]}>
                <View style={[styles.rankDot, { backgroundColor: r.color }]}>
                  <Icon name={r.icon} size={18} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontWeight: '700' }}>{t(`rank_${r.id}`)}</Txt>
                  <Txt variant="caption" muted>
                    {t('ordersNeeded', { n: r.minOrders })}
                  </Txt>
                </View>
                <Txt style={[{ fontWeight: '700', color: colors.textMuted }, styles.tabular]}>×{r.multiplier}</Txt>
              </View>
            );
          })}
        </Card>
        <Txt variant="caption" muted center>
          1 {t('pts')} = EGP {EGP_PER_POINT}
        </Txt>
      </ScrollView>

      <Modal visible={!!confirming} transparent animationType="fade" onRequestClose={() => setConfirming(null)}>
        <View style={styles.backdrop}>
          {confirming && (
            <Card style={{ padding: 24, alignItems: 'center', gap: 10 }}>
              <View style={[styles.rewardArt, { backgroundColor: colors.surfaceAlt, width: 72, height: 72 }]}>
                <Icon name={confirming.icon} size={36} color={colors.primary} />
              </View>
              <Txt variant="heading" center>
                {t('confirmRedeemTitle')}
              </Txt>
              <Txt style={{ fontWeight: '800', color: colors.primary }} center>
                {t(confirming.label)}
              </Txt>
              <Txt muted center>
                {t('confirmRedeemBody', { cost: confirming.cost })}
              </Txt>
              <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 8 }}>
                <Button
                  title={t('cancel')}
                  variant="secondary"
                  onPress={() => setConfirming(null)}
                  style={{ flex: 1 }}
                />
                <Button title={t('redeem')} onPress={onRedeem} loading={busy} style={{ flex: 1 }} />
              </View>
            </Card>
          )}
        </View>
      </Modal>
      <Confetti burstKey={burst} onDone={() => setBurst(0)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  rankBadge: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.6)' },
  rankDot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pointsBubble: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    minWidth: 78,
  },
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 6, backgroundColor: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  voucher: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  rewardArt: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  costRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 8,
    borderRadius: 14,
  },
  tabular: { fontVariant: ['tabular-nums'] },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
});
