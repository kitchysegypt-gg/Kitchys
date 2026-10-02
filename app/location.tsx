import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Coordinate, DeliveryMap } from '@/components/DeliveryMap';
import { Button, Icon, Txt } from '@/components/ui';
import { showAlert } from '@/lib/alert';
import { useSettings } from '@/lib/settings';
import { FONT } from '@/lib/fonts';

// Downtown Cairo, used until the customer picks a spot.
const DEFAULT_COORDINATE: Coordinate = { latitude: 30.0444, longitude: 31.2357 };

export default function LocationScreen() {
  const { t, colors, isRTL, location, setLocation } = useSettings();
  const [coordinate, setCoordinate] = useState<Coordinate>(
    location ? { latitude: location.latitude, longitude: location.longitude } : DEFAULT_COORDINATE
  );
  const [address, setAddress] = useState(location?.address ?? '');
  const [details, setDetails] = useState(location?.details ?? '');
  const [locating, setLocating] = useState(false);
  const [denied, setDenied] = useState(false);

  const lookUpAddress = async (c: Coordinate) => {
    try {
      const [place] = await Location.reverseGeocodeAsync(c);
      if (!place) return;
      const street = [place.streetNumber, place.street].filter(Boolean).join(' ') || place.name;
      setAddress([street, place.district ?? place.subregion, place.city].filter(Boolean).join(', '));
    } catch {
      // Reverse geocoding isn't available everywhere (e.g. web); the customer can type it.
    }
  };

  const moveTo = (c: Coordinate) => {
    setCoordinate(c);
    lookUpAddress(c);
  };

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setDenied(true);
        return;
      }
      setDenied(false);
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      moveTo({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch {
      setDenied(true);
    } finally {
      setLocating(false);
    }
  };

  const save = () => {
    if (!address.trim()) return showAlert(t('address'), t('addressRequired'));
    setLocation({ ...coordinate, address: address.trim(), details: details.trim() });
    router.back();
  };

  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.border,
      color: colors.text,
      textAlign: isRTL ? 'right' : 'left',
    } as const,
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.mapWrap}>
        <DeliveryMap coordinate={coordinate} onChange={moveTo} pinColor={colors.primary} />
        <SafeAreaView edges={['top']} style={styles.mapTop} pointerEvents="box-none">
          <Pressable onPress={() => router.back()} style={styles.round} hitSlop={10}>
            <Icon name="close" size={22} color="#1B1B1F" />
          </Pressable>
          <Pressable
            onPress={useMyLocation}
            style={[styles.locate, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {locating ? <ActivityIndicator color={colors.primary} /> : <Icon name="navigate" size={18} color={colors.primary} />}
            <Txt style={{ fontWeight: '600' }}>{locating ? t('locating') : t('useMyLocation')}</Txt>
          </Pressable>
        </SafeAreaView>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
          contentContainerStyle={{ padding: 20, gap: 12 }}
          keyboardShouldPersistTaps="handled">
          <View style={styles.row}>
            <Icon name="location" size={26} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Txt variant="heading">{t('location')}</Txt>
              <Txt variant="caption" muted>
                {t('dragPin')}
              </Txt>
            </View>
          </View>

          {denied && (
            <View style={[styles.notice, { backgroundColor: colors.surfaceAlt }]}>
              <Icon name="warning-outline" size={20} color={colors.danger} />
              <Txt variant="caption" style={{ flex: 1 }}>
                {t('locationDenied')}
              </Txt>
            </View>
          )}

          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder={t('addressPlaceholder')}
            placeholderTextColor={colors.textMuted}
            style={inputStyle}
          />
          <TextInput
            value={details}
            onChangeText={setDetails}
            placeholder={t('addressDetails')}
            placeholderTextColor={colors.textMuted}
            style={inputStyle}
          />

          <Pressable
            onPress={() =>
              Linking.openURL(
                `https://www.google.com/maps/search/?api=1&query=${coordinate.latitude},${coordinate.longitude}`
              )
            }>
            <Txt style={{ color: colors.primary, fontWeight: '600' }}>{t('openInMaps')}</Txt>
          </Pressable>

          <SafeAreaView edges={['bottom']}>
            <Button title={t('saveLocation')} onPress={save} />
          </SafeAreaView>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: { flex: 1, minHeight: 260 },
  mapTop: { position: 'absolute', left: 16, right: 16, top: 0, flexDirection: 'row', gap: 10, alignItems: 'center' },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  locate: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
  },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, marginTop: -24, maxHeight: 460 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 14 },
  input: { borderRadius: 14, borderWidth: 1, padding: 12, fontSize: 15, fontFamily: FONT.regular },
});
