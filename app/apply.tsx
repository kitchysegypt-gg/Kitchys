import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DishEditor } from '@/components/DishEditor';
import { PhotoPicker } from '@/components/PhotoPicker';
import { ChefPhoto } from '@/components/media';
import { Button, Card, EmptyState, ScreenHeader, Txt } from '@/components/ui';
import { showAlert } from '@/lib/alert';
import { useAuth } from '@/lib/auth';
import { DishDraft, emptyDish, isDishReady, submitApplication, useChefStatus } from '@/lib/chef';
import { useSettings } from '@/lib/settings';

export default function ApplyScreen() {
  const { t, colors, isRTL } = useSettings();
  const { session } = useAuth();
  const status = useChefStatus();
  const [name, setName] = useState((session?.user.user_metadata?.full_name as string) ?? '');
  const [phone, setPhone] = useState('');
  const [area, setArea] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [bio, setBio] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [dishes, setDishes] = useState<DishDraft[]>([emptyDish()]);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const input = [
    styles.input,
    {
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.border,
      color: colors.text,
      textAlign: isRTL ? 'right' : 'left',
    } as const,
  ];

  // Approved chefs manage their dishes in My kitchen instead.
  useEffect(() => {
    if (status.kitchen) router.replace('/kitchen');
  }, [status.kitchen]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const submit = async () => {
    const ready = dishes.filter(isDishReady);
    if (
      name.trim().length < 2 ||
      phone.trim().length < 6 ||
      area.trim().length < 2 ||
      specialty.trim().length < 2 ||
      !ready.length
    ) {
      return showAlert(t('applyTitle'), t('fillApplication'));
    }
    setBusy(true);
    try {
      await submitApplication({
        full_name: name.trim(),
        phone: phone.trim(),
        area: area.trim(),
        specialty: specialty.trim(),
        bio: bio.trim(),
        photo,
        dishes: ready,
      });
      setSent(true);
    } catch (e: any) {
      showAlert(t('error'), e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <SafeAreaView edges={['top']}>
      <ScreenHeader title={t('applyTitle')} onBack={close} />
    </SafeAreaView>
  );

  if (sent || status.application?.status === 'pending') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {header}
        <EmptyState
          icon="document-text-outline"
          title={sent ? t('applicationSent') : t('applicationPending')}
          body={t('applicationSentBody')}>
          <Button title={t('tabHome')} onPress={close} />
        </EmptyState>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {header}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 14, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled">
          <View style={styles.intro}>
            <ChefPhoto size={64} />
            <Txt muted style={{ flex: 1 }}>
              {t('applySubtitle')}
            </Txt>
          </View>
          {status.application?.status === 'rejected' && (
            <Txt style={{ color: colors.danger, fontWeight: '700' }}>{t('applicationRejected')}</Txt>
          )}

          <Card style={{ gap: 10 }}>
            <PhotoPicker value={photo} onChange={setPhoto} label={t('yourPhoto')} round aspect={[1, 1]} />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('fullName')}
              placeholderTextColor={colors.textMuted}
              maxLength={80}
              style={input}
            />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder={t('phone')}
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              maxLength={30}
              style={input}
            />
            <TextInput
              value={area}
              onChangeText={setArea}
              placeholder={t('area')}
              placeholderTextColor={colors.textMuted}
              maxLength={80}
              style={input}
            />
            <TextInput
              value={specialty}
              onChangeText={setSpecialty}
              placeholder={t('specialty')}
              placeholderTextColor={colors.textMuted}
              maxLength={80}
              style={input}
            />
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder={t('aboutYou')}
              placeholderTextColor={colors.textMuted}
              maxLength={600}
              multiline
              style={[input, { minHeight: 90 }]}
            />
          </Card>

          <Txt variant="heading" style={{ marginTop: 6 }}>
            {t('yourDishes')}
          </Txt>
          <Txt variant="caption" muted>
            {t('dinnerOnly')}
          </Txt>
          {dishes.map((d, i) => (
            <DishEditor
              key={i}
              title={`${t('addDish')} ${i + 1}`}
              value={d}
              onChange={(next) => setDishes((prev) => prev.map((x, j) => (j === i ? next : x)))}
              onRemove={dishes.length > 1 ? () => setDishes((prev) => prev.filter((_, j) => j !== i)) : undefined}
            />
          ))}
          {dishes.length < 15 && (
            <Button
              title={t('addDish')}
              icon="add"
              variant="secondary"
              onPress={() => setDishes((p) => [...p, emptyDish()])}
            />
          )}
          <Button title={t('submitApplication')} icon="send-outline" onPress={submit} loading={busy} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  input: { borderRadius: 14, borderWidth: 1, padding: 12, fontSize: 15 },
});
