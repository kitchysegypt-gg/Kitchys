import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PhotoPicker } from '@/components/PhotoPicker';
import { Button, Card, EmptyState, Icon, IconName, Screen, ScreenHeader, Txt } from '@/components/ui';
import { showAlert } from '@/lib/alert';
import { FONT } from '@/lib/fonts';
import { useOrders } from '@/lib/orders';
import { PROBLEM_KINDS, ProblemKind, reportOrderProblem } from '@/lib/problems';
import { useSettings } from '@/lib/settings';

const KIND_ICON: Record<ProblemKind, IconName> = {
  missing: 'remove-circle-outline',
  wrong: 'swap-horizontal-outline',
  cold: 'snow-outline',
  spilled: 'water-outline',
  late: 'time-outline',
  quality: 'thumbs-down-outline',
  other: 'chatbubble-ellipses-outline',
};

/** Orders > Problem with my order: what went wrong, a few words and a photo, sent to the team. */
export default function ProblemScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { t, colors, isRTL, formatPrice } = useSettings();
  const { orders } = useOrders();
  const [kind, setKind] = useState<ProblemKind | null>(null);
  const [details, setDetails] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const order = orders.find((o) => o.id === orderId);
  if (!order)
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title={t('error')} />
      </Screen>
    );

  // A late order can be reported while it's on the way; everything else once it arrived.
  const kinds = order.status === 'on_the_way' ? (['late'] as ProblemKind[]) : PROBLEM_KINDS;
  const needsDetails = kind === 'other' || kind === 'quality';
  const canSend = !!kind && (!needsDetails || details.trim().length >= 5);

  const send = async () => {
    if (!kind) return;
    setBusy(true);
    try {
      await reportOrderProblem({ orderId: order.id, kind, details, photo });
      showAlert(t('problemSentTitle'), t('problemSentBody'));
      router.back();
    } catch (e: any) {
      showAlert(t('error'), e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView edges={['top']}>
        <ScreenHeader title={t('reportProblem')} />
      </SafeAreaView>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Txt muted>
            {t('problemIntro', { order: order.id.slice(0, 6).toUpperCase(), total: formatPrice(order.total) })}
          </Txt>
          <Card style={{ gap: 4, padding: 6 }}>
            {kinds.map((k) => {
              const on = kind === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => setKind(k)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={[styles.kind, on && { backgroundColor: `${colors.primary}14` }]}>
                  <Icon name={KIND_ICON[k]} size={22} color={on ? colors.primary : colors.textMuted} />
                  <Txt style={{ flex: 1, fontWeight: on ? '700' : '500' }}>{t(`problem_${k}`)}</Txt>
                  <Icon name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? colors.primary : colors.border} />
                </Pressable>
              );
            })}
          </Card>
          <TextInput
            value={details}
            onChangeText={setDetails}
            placeholder={t('problemDetailsPlaceholder')}
            placeholderTextColor={colors.textMuted}
            maxLength={1000}
            multiline
            style={[
              styles.input,
              { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text, textAlign: isRTL ? 'right' : 'left' },
            ]}
          />
          <PhotoPicker value={photo} onChange={setPhoto} label={t('problemPhoto')} />
          <Txt variant="caption" muted>
            {t('problemRefundNote')}
          </Txt>
          <Button title={t('problemSend')} icon="send" onPress={send} loading={busy} disabled={!canSend} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  kind: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 12 },
  input: { borderRadius: 14, borderWidth: 1, padding: 12, fontSize: 15, fontFamily: FONT.regular, minHeight: 90 },
});
