import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useEffect } from 'react';

import {
  CLOSE_MINUTES,
  DEFAULT_MINUTES,
  OPEN_MINUTES,
  SCHEDULE_DAYS,
  STEP_MINUTES,
  clampToHours,
  dayHasSlots,
  firstMinutesFor,
  isKitchenOpen,
  formatDay,
  formatTime,
  isTooSoon,
  nextOpening,
  slotDate,
} from '@/lib/schedule';
import { useSettings } from '@/lib/settings';
import { Card, Chip, Icon, Txt } from './ui';

export type ScheduleValue = { mode: 'asap' } | { mode: 'later'; day: number; minutes: number };

/** Shortcuts; only the ones inside the chef's hours for the picked day are shown. */
const QUICK_TIMES = [13, 15, 18, 19, 20, 21, 22, 23].map((h) => h * 60);

/**
 * "As soon as possible" (only while the chef's kitchen is open, 10 AM until their last delivery
 * time) or any day in the next 2 weeks within those hours, in 15-minute steps. Ordering while the
 * kitchen is closed, the next day it opens starts at 1 PM.
 */
export function SchedulePicker({
  value,
  onChange,
  close = CLOSE_MINUTES,
  asapOnly = false,
}: {
  value: ScheduleValue;
  onChange: (v: ScheduleValue) => void;
  /** The chef's last delivery time, in minutes after midnight. */
  close?: number;
  /** Today's deals are already cooked: they can only be delivered as soon as possible. */
  asapOnly?: boolean;
}) {
  const { t, colors, language } = useSettings();
  const open = isKitchenOpen(new Date(), close);

  /** A day's suggested time: 7 PM, moved inside what that day allows. */
  const timeFor = (day: number, minutes = DEFAULT_MINUTES) => clampToHours(minutes, day, close);

  const pickLater = () => {
    const day = [0, 1, 2].find((d) => dayHasSlots(d, close)) ?? 1;
    onChange({ mode: 'later', day, minutes: timeFor(day) });
  };

  // Kitchens are closed: "as soon as possible" isn't possible, so start on a scheduled time.
  // With a deal in the cart it's the other way round: only "as soon as possible".
  useEffect(() => {
    if (asapOnly && value.mode === 'later') onChange({ mode: 'asap' });
    else if (!asapOnly && !open && value.mode === 'asap') pickLater();
    // Only when the picker opens, the kitchens close or a deal is added.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, asapOnly]);

  // The chef's hours can change (another chef in the cart): keep the picked time inside them.
  const laterDay = value.mode === 'later' ? value.day : -1;
  const laterMinutes = value.mode === 'later' ? value.minutes : -1;
  useEffect(() => {
    if (laterDay < 0) return;
    const fitted = timeFor(laterDay, laterMinutes);
    if (fitted !== laterMinutes) onChange({ mode: 'later', day: laterDay, minutes: fitted });
    // Only when the chef's hours or the picked day change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [close, laterDay]);

  const setMinutes = (day: number, minutes: number) => {
    onChange({ mode: 'later', day, minutes: timeFor(day, minutes) });
  };

  const first = value.mode === 'later' ? firstMinutesFor(value.day, close) : OPEN_MINUTES;
  const quickTimes = QUICK_TIMES.filter((m) => m >= first && m <= close);

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
        {(open || asapOnly) && (
          <Chip
            label={t('asap')}
            icon="delivery"
            active={value.mode === 'asap'}
            onPress={() => onChange({ mode: 'asap' })}
          />
        )}
        {!asapOnly && (
          <Chip label={t('schedule')} icon="calendar-outline" active={value.mode === 'later'} onPress={pickLater} />
        )}
      </View>
      <Txt variant="caption" muted>
        {asapOnly
          ? t('dealAsapOnly')
          : open
          ? t('kitchenHours', { from: formatTime(OPEN_MINUTES, language), to: formatTime(close, language) })
          : t('closedSchedule', {
              day: formatDay(nextOpening().day, language, { today: t('today'), tomorrow: t('tomorrow') }),
              from: formatTime(firstMinutesFor(nextOpening().day, close), language),
              to: formatTime(close, language),
            })}
      </Txt>

      {value.mode === 'later' && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {Array.from({ length: SCHEDULE_DAYS }, (_, day) => day)
              .filter((day) => dayHasSlots(day, close))
              .map((day) => (
                <Chip
                  key={day}
                  label={formatDay(day, language, { today: t('today'), tomorrow: t('tomorrow') })}
                  active={value.day === day}
                  onPress={() => onChange({ ...value, day, minutes: timeFor(day, value.minutes) })}
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
            {quickTimes.map((m) => (
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
