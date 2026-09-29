import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Modal, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Confetti } from '@/components/Confetti';
import { Emoji3D } from '@/components/Emoji3D';
import { Button3D, Card3D, Screen, Txt } from '@/components/ui';
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
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}>
        <LinearGradient colors={[rank.color, colors.primaryDeep]} style={styles.hero}>
          <View style={styles.heroTop}>
            <Emoji3D name={rank.emoji} size={72} float />
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
              <Emoji3D name="coin" size={28} />
              <Txt variant="heading" color="#1E1B18" center style={styles.tabular}>
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

        <Card3D style={styles.row}>
          <Emoji3D name="sparkles" size={32} />
          <Txt style={{ flex: 1, fontWeight: '700' }}>{t('earnRule')}</Txt>
        </Card3D>

        {/* Vouchers the customer already owns */}
        <View style={styles.sectionTitle}>
          <Emoji3D name="ticket" size={28} />
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
                  <Emoji3D name={reward?.emoji ?? 'ticket'} size={36} />
                  <Txt style={{ flex: 1, fontWeight: '800' }}>{reward ? t(reward.label) : v.reward_id}</Txt>
                  <Emoji3D name="cart" size={24} />
                </View>
              );
            })}
          </View>
        )}

        {/* Catalogue */}
        <View style={styles.sectionTitle}>
          <Emoji3D name="gift" size={28} />
          <Txt variant="heading">{t('rewards')}</Txt>
        </View>
        <View style={{ gap: 12 }}>
          {REWARDS.map((reward) => {
            const locked = rank.level < reward.minRank;
            const short = reward.cost - points;
            const lockedRank = RANKS[reward.minRank];
            return (
              <Card3D key={reward.id} style={[styles.row, locked && { opacity: 0.6 }]}>
                <View style={[styles.rewardArt, { backgroundColor: colors.surfaceAlt }]}>
                  <Emoji3D name={locked ? 'locked' : reward.emoji} size={40} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt style={{ fontWeight: '800' }}>{t(reward.label)}</Txt>
                  <View style={styles.costRow}>
                    <Emoji3D name="coin" size={16} />
                    <Txt variant="caption" style={[{ fontWeight: '800', color: colors.primary }, styles.tabular]}>
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
                <Button3D
                  small
                  title={t('redeem')}
                  disabled={locked || short > 0}
                  onPress={() => setConfirming(reward)}
                />
              </Card3D>
            );
          })}
        </View>

        {/* Rank ladder */}
        <View style={styles.sectionTitle}>
          <Emoji3D name="trophy" size={28} />
          <Txt variant="heading">{t('ranks')}</Txt>
        </View>
        <Card3D style={{ gap: 4, paddingVertical: 8 }}>
          {RANKS.map((r) => {
            const current = r.id === rank.id;
            return (
              <View
                key={r.id}
                style={[styles.rankRow, current && { backgroundColor: colors.surfaceAlt, borderColor: r.color }]}>
                <Emoji3D name={r.emoji} size={34} />
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontWeight: '800' }}>{t(`rank_${r.id}`)}</Txt>
                  <Txt variant="caption" muted>
                    {t('ordersNeeded', { n: r.minOrders })}
                  </Txt>
                </View>
                <Txt style={[{ fontWeight: '900', color: r.color }, styles.tabular]}>×{r.multiplier}</Txt>
              </View>
            );
          })}
        </Card3D>
        <Txt variant="caption" muted center>
          1 {t('pts')} = EGP {EGP_PER_POINT}
        </Txt>
      </ScrollView>

      <Modal visible={!!confirming} transparent animationType="fade" onRequestClose={() => setConfirming(null)}>
        <View style={styles.backdrop}>
          {confirming && (
            <Card3D style={{ padding: 24, alignItems: 'center', gap: 10 }}>
              <Emoji3D name={confirming.emoji} size={96} float />
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
                <Button3D
                  title={t('cancel')}
                  variant="secondary"
                  onPress={() => setConfirming(null)}
                  style={{ flex: 1 }}
                />
                <Button3D title={t('redeem')} emoji="coin" onPress={onRedeem} loading={busy} style={{ flex: 1 }} />
              </View>
            </Card3D>
          )}
        </View>
      </Modal>
      <Confetti burstKey={burst} onDone={() => setBurst(0)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 26,
    padding: 18,
    gap: 12,
    borderBottomWidth: 6,
    borderBottomColor: 'rgba(0,0,0,0.2)',
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pointsBubble: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    minWidth: 78,
  },
  track: { height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 6, backgroundColor: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  voucher: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  rewardArt: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  costRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 8,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tabular: { fontVariant: ['tabular-nums'] },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
});
