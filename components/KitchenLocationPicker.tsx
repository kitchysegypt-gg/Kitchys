import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Coordinate, DeliveryMap } from '@/components/DeliveryMap';
import { Button, Card, Icon, IconBadge, Txt } from '@/components/ui';
import { DELIVERY_RADIUS_KM } from '@/lib/catalog';
import { addressFor, currentPosition } from '@/lib/geocode';
import { useSettings } from '@/lib/settings';

type Props = {
  value: Coordinate | null;
  onChange: (value: Coordinate) => void;
  /** Shown under the map, e.g. a save button in My kitchen. */
  children?: React.ReactNode;
};

/** Where a home chef cooks: from GPS or their saved address, fine-tuned on the map. */
export function KitchenLocationPicker({ value, onChange, children }: Props) {
  const { t, colors, location, language } = useSettings();
  const [locating, setLocating] = useState(false);
  const [problem, setProblem] = useState<'denied' | 'failed' | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    if (!value) return;
    let cancelled = false;
    addressFor(value, language).then((found) => {
      if (!cancelled) setAddress(found);
    });
    return () => {
      cancelled = true;
    };
  }, [value, language]);

  const useWhereIAm = async () => {
    setLocating(true);
    setProblem(null);
    const found = await currentPosition();
    setLocating(false);
    if (found === 'denied') setProblem('denied');
    else if (!found) setProblem('failed');
    else onChange(found);
  };

  return (
    <Card style={{ gap: 10 }}>
      <View style={styles.row}>
        <IconBadge name="home-outline" tone="orange" size={32} />
        <Txt variant="heading" style={{ flex: 1, fontSize: 17 }}>
          {t('kitchenLocation')}
        </Txt>
        {value && <Icon name="checkmark-circle" size={22} color={colors.success} />}
      </View>
      <Txt variant="caption" muted>
        {t('kitchenLocationHint', { km: DELIVERY_RADIUS_KM })}
      </Txt>

      {value && (
        <>
          <View style={[styles.map, { borderColor: colors.border }]}>
            <DeliveryMap coordinate={value} onChange={onChange} pinColor={colors.primary} />
          </View>
          {address ? <Txt style={{ fontWeight: '600' }}>{address}</Txt> : null}
          {Platform.OS !== 'web' && (
            <Txt variant="caption" muted>
              {t('tapMapToAdjust')}
            </Txt>
          )}
        </>
      )}

      {problem && (
        <View style={[styles.notice, { backgroundColor: colors.surfaceAlt }]}>
          <Icon name="warning-outline" size={20} color={colors.danger} />
          <Txt variant="caption" style={{ flex: 1 }}>
            {problem === 'denied' ? t('locationDenied') : t('locationFailed')}
          </Txt>
        </View>
      )}

      <Button
        title={t('useWhereIAm')}
        icon="navigate"
        variant={value ? 'secondary' : 'primary'}
        onPress={useWhereIAm}
        loading={locating}
      />
      {location && (
        <Button
          title={t('useSavedAddress')}
          icon="location-outline"
          variant="secondary"
          onPress={() => onChange({ latitude: location.latitude, longitude: location.longitude })}
        />
      )}
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  map: { height: 190, borderRadius: 14, overflow: 'hidden', borderWidth: 1 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 14 },
});
