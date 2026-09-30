import type { Language } from './i18n';

/** Customers can schedule up to this many days ahead (the database enforces 14). */
export const SCHEDULE_DAYS = 14;
export const STEP_MINUTES = 15;
/** Earliest a scheduled order can be, from now. */
export const MIN_LEAD_MINUTES = 30;
/** Dinner time is the suggested default. */
export const DEFAULT_MINUTES = 19 * 60;

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
