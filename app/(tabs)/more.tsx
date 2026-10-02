import Constants from 'expo-constants';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, Icon, ListGroup, ListRow, PressableScale, Screen, Txt } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useCatalog } from '@/lib/catalog';
import { useChefStatus } from '@/lib/chef';
import { useOrders } from '@/lib/orders';
import { useSettings } from '@/lib/settings';
import { isDemo, supabase } from '@/lib/supabase';

export default function MoreScreen() {
  const { t, colors, location } = useSettings();
  const { session } = useAuth();
  const { points, rank } = useOrders();
  const chefStatus = useChefStatus();
  const { refresh: refreshCatalog } = useCatalog();

  const name = (session?.user.user_metadata?.full_name as string | undefined) || session?.user.email || '';
  const initials = name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  const approveInDemo = async () => {
    if (!chefStatus.application) return;
    await supabase.rpc('approve_chef_application', { p_id: chefStatus.application.id });
    await chefStatus.reload();
    await refreshCatalog();
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 22, paddingBottom: 40 }}>
        <View style={styles.profile}>
          <View style={[styles.initials, { backgroundColor: colors.primary }]}>
            <Txt color={colors.onPrimary} style={{ fontWeight: '700', fontSize: 18 }}>
              {initials}
            </Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="heading" numberOfLines={1}>
              {name}
            </Txt>
            {session?.user.user_metadata?.full_name ? (
              <Txt variant="caption" muted numberOfLines={1}>
                {session.user.email}
              </Txt>
            ) : null}
          </View>
        </View>

        <View style={styles.tiles}>
          <PressableScale onPress={() => router.navigate('/orders')} style={{ flex: 1 }}>
            <Card style={styles.tile}>
              <View style={[styles.tileIcon, { backgroundColor: colors.surfaceAlt }]}>
                <Icon name="receipt-outline" size={24} color={colors.primary} />
              </View>
              <Txt style={styles.tileTitle}>{t('orderHistory')}</Txt>
            </Card>
          </PressableScale>
          <PressableScale onPress={() => router.push('/rewards')} style={{ flex: 1 }}>
            <Card style={styles.tile}>
              <View style={[styles.tileIcon, { backgroundColor: rank.color }]}>
                <Icon name={rank.icon} size={22} color="#fff" />
              </View>
              <Txt style={styles.tileTitle} numberOfLines={1}>
                {t('kitchysPoints')}
              </Txt>
              <Txt style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>
                {t('pointsCount', { n: points.toLocaleString() })}
              </Txt>
            </Card>
          </PressableScale>
        </View>

        <ListGroup title={t('explore')}>
          <ListRow
            icon="gift-outline"
            label={t('referFriend')}
            detail={t('referTagline')}
            onPress={() => router.push('/refer')}
          />
          <ListRow icon="chatbubble-ellipses-outline" label={t('chatTitle')} onPress={() => router.push('/chat')} />
          <ListRow
            icon="location-outline"
            label={t('deliveryAddress')}
            detail={location?.address || t('setLocation')}
            onPress={() => router.push('/location')}
          />
          {chefStatus.kitchen ? (
            <ListRow icon="restaurant-outline" label={t('myKitchen')} onPress={() => router.push('/kitchen')} />
          ) : chefStatus.application?.status === 'pending' ? (
            <>
              <ListRow icon="hourglass-outline" label={t('applicationPending')} />
              {isDemo && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                  <Button small variant="secondary" title={t('demoApprove')} onPress={approveInDemo} />
                </View>
              )}
            </>
          ) : (
            <ListRow icon="restaurant-outline" label={t('becomeChef')} onPress={() => router.push('/apply')} />
          )}
        </ListGroup>

        <ListGroup title={t('account')}>
          <ListRow icon="settings-outline" label={t('settings')} onPress={() => router.push('/settings')} />
          <ListRow icon="help-circle-outline" label={t('howToUse')} onPress={() => router.push('/guide')} />
        </ListGroup>

        <Txt muted center>
          {t('version')} {Constants.expoConfig?.version}
        </Txt>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 4, paddingTop: 8 },
  initials: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  tiles: { flexDirection: 'row', gap: 12 },
  tile: { gap: 10, minHeight: 130, padding: 16 },
  tileIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontSize: 16, fontWeight: '600' },
});
