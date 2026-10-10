import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from '@/components/Logo';
import { showAlert } from '@/lib/alert';
import { useAuth } from '@/lib/auth';
import { FONT } from '@/lib/fonts';
import { Vehicle, riderSignOut, useRider } from '@/lib/rider';
import { useSettings } from '@/lib/settings';
import { Button, Card, Chip, EmptyState, Txt } from './ui';

const VEHICLES: Vehicle[] = ['motorbike', 'scooter', 'bicycle', 'car'];

/** Before approval: the rider application form, or "waiting for approval". */
export function RiderApply() {
  const { t, colors, isRTL } = useSettings();
  const { session } = useAuth();
  const { status, apply, refresh } = useRider();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState((session?.user.user_metadata?.full_name as string) ?? '');
  const [phone, setPhone] = useState('');
  const [area, setArea] = useState('');
  const [vehicle, setVehicle] = useState<Vehicle>('motorbike');
  const [busy, setBusy] = useState(false);

  const input = [
    styles.input,
    { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text, textAlign: isRTL ? 'right' : 'left' } as const,
  ];

  const submit = async () => {
    if (name.trim().length < 2 || phone.replace(/\D/g, '').length < 8 || area.trim().length < 2) {
      return showAlert(t('riderApplyTitle'), t('riderFillAll'));
    }
    setBusy(true);
    try {
      await apply({ name: name.trim(), phone: phone.trim(), vehicle, area: area.trim() });
      setEditing(false);
    } catch (e: any) {
      showAlert(t('error'), e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const showForm = status === 'none' || editing;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', gap: 6, marginTop: 8 }}>
            <Logo width={110} />
            <Txt variant="heading" style={{ color: colors.primary }}>
              {t('riderAppName')}
            </Txt>
          </View>

          {showForm ? (
            <Card style={{ gap: 12 }}>
              <Txt variant="title">{t('riderApplyTitle')}</Txt>
              <Txt muted>{t('riderApplyBody')}</Txt>
              <TextInput value={name} onChangeText={setName} placeholder={t('riderName')} placeholderTextColor={colors.textMuted} style={input} />
              <TextInput
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/[^0-9+ ]/g, ''))}
                placeholder={t('riderPhone')}
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                maxLength={20}
                style={input}
              />
              <TextInput value={area} onChangeText={setArea} placeholder={t('riderAreaPlaceholder')} placeholderTextColor={colors.textMuted} style={input} />
              <Txt variant="caption" muted>
                {t('riderVehicle')}
              </Txt>
              <View style={styles.chips}>
                {VEHICLES.map((v) => (
                  <Chip key={v} label={t(`vehicle_${v}`)} active={vehicle === v} onPress={() => setVehicle(v)} />
                ))}
              </View>
              <Button title={t('riderApplySubmit')} icon="bicycle" onPress={submit} loading={busy} />
            </Card>
          ) : status === 'pending' ? (
            <EmptyState icon="hourglass-outline" title={t('riderPendingTitle')} body={t('riderPendingBody')}>
              <Button title={t('riderCheckAgain')} variant="secondary" icon="refresh" onPress={refresh} />
            </EmptyState>
          ) : (
            <EmptyState icon="close-circle-outline" title={t('riderRejectedTitle')} body={t('riderRejectedBody')}>
              <Button title={t('riderApplySubmit')} onPress={() => setEditing(true)} />
            </EmptyState>
          )}

          <Button title={t('signOut')} variant="ghost" icon="log-out-outline" onPress={riderSignOut} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  input: { borderRadius: 14, borderWidth: 1, padding: 12, fontSize: 15, fontFamily: FONT.regular },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
