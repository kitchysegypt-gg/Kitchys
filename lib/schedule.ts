import type { Language } from './i18n';

/** Customers can schedule up to this many days ahead (the database enforces 14). */
export const SCHEDULE_DAYS = 14;
export const STEP_MINUTES = 15;
/** Earliest a scheduled order can be, from now. */
export const MIN_LEAD_MINUTES = 30;
/** Dinner time is the suggested default. */
export const DEFAULT_MINUTES = 19 * 60;
/**
 * Kitchens open at 10:00. Each chef picks their last delivery time (1 PM - 11 PM, 9 PM until
 * they choose). The database checks the same rules in Cairo time.
 */
export const OPEN_MINUTES = 10 * 60;
export const CLOSE_MINUTES = 21 * 60;
export const EARLIEST_LAST_DELIVERY = 13 * 60;
export const LATEST_LAST_DELIVERY = 23 * 60;
/** Ordered while the kitchen is closed: the next day it opens starts at 1 PM, so the chef can cook. */
export const AFTER_CLOSED_FIRST_MINUTES = 13 * 60;

const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();

/** True while a kitchen is open (10:00 until its last delivery time), so "as soon as possible" works. */
export function isKitchenOpen(now = new Date(), close = CLOSE_MINUTES) {
  const m = minutesOf(now);
  return m >= OPEN_MINUTES && m < close;
}

/** True when a delivery time falls inside opening hours (the closing time itself is the last slot). */
export function isWithinHours(date: Date, close = CLOSE_MINUTES) {
  const m = minutesOf(date);
  return m >= OPEN_MINUTES && m <= close;
}

/** When a kitchen next opens: today (before 10:00) or tomorrow (after closing). */
export function nextOpening(now = new Date()): { day: 0 | 1; minutes: number } {
  return minutesOf(now) < OPEN_MINUTES ? { day: 0, minutes: OPEN_MINUTES } : { day: 1, minutes: OPEN_MINUTES };
}

/** The earliest time of day a customer can pick for a day (0 = today), given the chef's closing time. */
export function firstMinutesFor(day: number, close = CLOSE_MINUTES, now = new Date()) {
  if (!isKitchenOpen(now, close) && day === nextOpening(now).day) return AFTER_CLOSED_FIRST_MINUTES;
  if (day === 0) return Math.max(OPEN_MINUTES, earliestMinutesToday(now));
  return OPEN_MINUTES;
}

/** Keeps a picked time of day inside what that day allows. */
export function clampToHours(minutes: number, day = 1, close = CLOSE_MINUTES, now = new Date()) {
  return Math.min(close, Math.max(firstMinutesFor(day, close, now), minutes));
}

/** True when the chef can still deliver on that day at all (late in the evening "today" is over). */
export function dayHasSlots(day: number, close = CLOSE_MINUTES, now = new Date()) {
  return firstMinutesFor(day, close, now) <= close;
}

/** True when a scheduled time is before 1 PM on the first day after ordering while closed. */
export function isBeforeAfterClosedStart(date: Date, close = CLOSE_MINUTES, now = new Date()) {
  if (isKitchenOpen(now, close)) return false;
  const first = startOfDay(nextOpening(now).day, now);
  return startOfDay(0, date).getTime() === first.getTime() && minutesOf(date) < AFTER_CLOSED_FIRST_MINUTES;
}

const locale = (language: Language) => (language === 'ar' ? 'ar-EG' : language);

export function startOfDay(offset: number, now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}

/** The delivery moment for a day offset (0 = today) and minutes after midnight. */
export function slotDate(dayOffset: number, minutes: number, now = new Date()) {
  const d = startOfDay(dayOffset, now);
  d.setMinutes(minutes);
  return d;
}

export function isTooSoon(date: Date, now = new Date()) {
  return date.getTime() < now.getTime() + MIN_LEAD_MINUTES * 60_000;
}

/** The first slot on a 15-minute step that's far enough away, used when "today" is picked late. */
export function earliestMinutesToday(now = new Date()) {
  const earliest = now.getHours() * 60 + now.getMinutes() + MIN_LEAD_MINUTES;
  return Math.ceil(earliest / STEP_MINUTES) * STEP_MINUTES;
}

export function formatTime(minutes: number, language: Language) {
  return slotDate(0, minutes).toLocaleTimeString(locale(language), { hour: 'numeric', minute: '2-digit' });
}

export function formatDay(dayOffset: number, language: Language, labels: { today: string; tomorrow: string }) {
  if (dayOffset === 0) return labels.today;
  if (dayOffset === 1) return labels.tomorrow;
  return startOfDay(dayOffset).toLocaleDateString(locale(language), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** e.g. "Tue, 30 Sep, 7:00 PM" */
export function formatSlot(date: Date, language: Language) {
  return date.toLocaleString(locale(language), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
