import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from '@/components/Logo';
import { PhotoPicker } from '@/components/PhotoPicker';
import { showAlert } from '@/lib/alert';
import { useAuth } from '@/lib/auth';
import { FONT } from '@/lib/fonts';
import { Vehicle, riderSignOut, useRider } from '@/lib/rider';
import { useSettings } from '@/lib/settings';
import { Button, Card, Chip, EmptyState, Icon, Txt } from './ui';

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
  const [nationalId, setNationalId] = useState('');
  const [plate, setPlate] = useState('');
  const [idFront, setIdFront] = useState<string | null>(null);
  const [idBack, setIdBack] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [vehiclePhoto, setVehiclePhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Bicycles have no plate.
  const motor = vehicle !== 'bicycle';

  const input = [
    styles.input,
    { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text, textAlign: isRTL ? 'right' : 'left' } as const,
  ];

  const submit = async () => {
    if (name.trim().length < 2 || phone.replace(/\D/g, '').length < 8 || area.trim().length < 2) {
      return showAlert(t('riderApplyTitle'), t('riderFillAll'));
    }
    if (nationalId.replace(/\D/g, '').length !== 14 || !idFront || !idBack || !selfie) {
      return showAlert(t('riderVerifyTitle'), t('riderNeedId'));
    }
    if (motor && (!vehiclePhoto || plate.trim().length < 3)) {
      return showAlert(t('riderVehicleSection'), t('riderNeedVehicle'));
    }
    setBusy(true);
    try {
      await apply({
        name: name.trim(),
        phone: phone.trim(),
        vehicle,
        area: area.trim(),
        nationalId: nationalId.replace(/\D/g, ''),
        plate: plate.trim(),
        idFront,
        idBack,
        selfie,
        vehiclePhoto,
      });
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
              {motor && (
                <>
                  <TextInput
                    value={plate}
                    onChangeText={setPlate}
                    placeholder={t('riderPlatePlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="characters"
                    maxLength={15}
                    style={input}
                  />
                  <PhotoPicker value={vehiclePhoto} onChange={setVehiclePhoto} label={t('riderVehiclePhoto')} />
                </>
              )}

              <Txt variant="heading" style={{ marginTop: 6 }}>
                {t('riderVerifyTitle')}
              </Txt>
              <View style={[styles.note, { backgroundColor: colors.surfaceAlt }]}>
                <Icon name="lock-closed-outline" size={18} color={colors.primary} />
                <Txt variant="caption" style={{ flex: 1 }}>
                  {t('riderDocsPrivate')}
                </Txt>
              </View>
              <TextInput
                value={nationalId}
                onChangeText={(v) => setNationalId(v.replace(/\D/g, '').slice(0, 14))}
                placeholder={t('riderNationalId')}
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={14}
                style={input}
              />
              <PhotoPicker value={idFront} onChange={setIdFront} label={t('riderIdFront')} aspect={[16, 10]} />
              <PhotoPicker value={idBack} onChange={setIdBack} label={t('riderIdBack')} aspect={[16, 10]} />
              <PhotoPicker value={selfie} onChange={setSelfie} label={t('riderSelfie')} aspect={[3, 4]} />
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
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12 },
});
