import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useEffect } from 'react';

import {
  CLOSE_MINUTES,
  DEFAULT_MINUTES,
  OPEN_MINUTES,
  SCHEDULE_DAYS,
  STEP_MINUTES,
  clampToHours,
  earliestMinutesToday,
  isKitchenOpen,
  formatDay,
  formatTime,
  isTooSoon,
  slotDate,
} from '@/lib/schedule';
import { useSettings } from '@/lib/settings';
import { Card, Chip, Icon, Txt } from './ui';

export type ScheduleValue = { mode: 'asap' } | { mode: 'later'; day: number; minutes: number };

const QUICK_TIMES = [18 * 60, 19 * 60, 20 * 60, 21 * 60];

/**
 * "As soon as possible" (only while kitchens are open, 10 AM - 9 PM) or any day in the next
 * 2 weeks at a time within opening hours, in 15-minute steps.
 */
export function SchedulePicker({ value, onChange }: { value: ScheduleValue; onChange: (v: ScheduleValue) => void }) {
  const { t, colors, language } = useSettings();
  const open = isKitchenOpen();

  const pickLater = () => {
    const today = earliestMinutesToday();
    // Default to 7 PM today (or the earliest time after that), else tomorrow at 7 PM.
    const minutes = Math.max(DEFAULT_MINUTES, today);
    onChange(
      minutes <= CLOSE_MINUTES
        ? { mode: 'later', day: 0, minutes }
        : { mode: 'later', day: 1, minutes: DEFAULT_MINUTES }
    );
  };

  // Kitchens are closed: "as soon as possible" isn't possible, so start on a scheduled time.
  useEffect(() => {
    if (!open && value.mode === 'asap') pickLater();
    // Only when the picker opens or the kitchens close.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setMinutes = (day: number, minutes: number) => {
    onChange({ mode: 'later', day, minutes: clampToHours(minutes) });
  };

  const tooSoon = value.mode === 'later' && isTooSoon(slotDate(value.day, value.minutes));

  return (
    <Card style={{ gap: 12 }}>
      <View style={styles.row}>
        <Icon name="time-outline" size={18} color={colors.textMuted} />
        <Txt variant="label" muted>
          {t('deliveryTime')}
        </Txt>
      </View>
      <View style={styles.row}>
        {open && (
          <Chip
            label={t('asap')}
            icon="delivery"
            active={value.mode === 'asap'}
            onPress={() => onChange({ mode: 'asap' })}
          />
        )}
        <Chip label={t('schedule')} icon="calendar-outline" active={value.mode === 'later'} onPress={pickLater} />
      </View>
      <Txt variant="caption" muted>
        {open
          ? t('kitchenHours', { from: formatTime(OPEN_MINUTES, language), to: formatTime(CLOSE_MINUTES, language) })
          : t('closedSchedule', { from: formatTime(OPEN_MINUTES, language), to: formatTime(CLOSE_MINUTES, language) })}
      </Txt>

      {value.mode === 'later' && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {Array.from({ length: SCHEDULE_DAYS }, (_, day) => (
              <Chip
                key={day}
                label={formatDay(day, language, { today: t('today'), tomorrow: t('tomorrow') })}
                active={value.day === day}
                onPress={() => onChange({ ...value, day })}
              />
            ))}
          </ScrollView>

          <View style={[styles.timeRow, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Pressable
              onPress={() => setMinutes(value.day, value.minutes - STEP_MINUTES)}
              hitSlop={8}
              accessibilityLabel="-15">
              <Icon name="remove-circle-outline" size={32} color={colors.primary} />
            </Pressable>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Txt variant="caption" muted>
                {t('pickTime')}
              </Txt>
              <Txt variant="title" style={{ fontVariant: ['tabular-nums'] }}>
                {formatTime(value.minutes, language)}
              </Txt>
            </View>
            <Pressable
              onPress={() => setMinutes(value.day, value.minutes + STEP_MINUTES)}
              hitSlop={8}
              accessibilityLabel="+15">
              <Icon name="add-circle-outline" size={32} color={colors.primary} />
            </Pressable>
          </View>

          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            {QUICK_TIMES.map((m) => (
              <Chip
                key={m}
                label={formatTime(m, language)}
                active={value.minutes === m}
                onPress={() => setMinutes(value.day, m)}
              />
            ))}
          </View>

          {tooSoon && (
            <Txt variant="caption" style={{ color: colors.danger, fontWeight: '600' }}>
              {t('timeTooSoon')}
            </Txt>
          )}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
});
