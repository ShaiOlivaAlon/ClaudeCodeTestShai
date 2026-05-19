import { SleepEntry, DailySummary, NextSleepSuggestion } from '../types';
import {
  startOfDay,
  endOfDay,
  differenceInMinutes,
  differenceInMilliseconds,
  isWithinInterval,
  parseISO,
  getHours,
  addMinutes,
  isAfter,
  isBefore,
} from 'date-fns';

// Wake window targets for a 9-month-old (in minutes)
// After morning wake: 150-180 min (2.5-3h) → Nap 1
// After Nap 1: 180-210 min (3-3.5h) → Nap 2
// After Nap 2: 210-240 min (3.5-4h) → Bedtime
const WAKE_WINDOWS = {
  afterNightSleep: { min: 150, max: 180, ideal: 165 },
  afterNap1: { min: 180, max: 210, ideal: 195 },
  afterNap2: { min: 210, max: 240, ideal: 225 },
};

const BEDTIME_HOUR = 19; // 7 PM
const NAP_MAX_DURATION_MINUTES = 105; // 1.75 hours

/**
 * Returns 'night' if the start time is between 6 PM and 6 AM, else 'nap'
 */
export function classifySleepType(startTime: string | Date): 'night' | 'nap' {
  const dt = typeof startTime === 'string' ? parseISO(startTime) : startTime;
  const hour = getHours(dt);
  // Night sleep: starts between 6 PM (18) and 5 AM (5) inclusive
  if (hour >= 18 || hour < 6) {
    return 'night';
  }
  return 'nap';
}

/**
 * Get all completed entries for a specific date
 */
export function getEntriesForDate(entries: SleepEntry[], date: Date): SleepEntry[] {
  const start = startOfDay(date);
  const end = endOfDay(date);
  return entries.filter((e) => {
    const entryStart = parseISO(e.startTime);
    // An entry "belongs" to a date if it starts on that date, or
    // if it's a night sleep that overlaps the day
    return isWithinInterval(entryStart, { start, end }) ||
      (e.endTime && isWithinInterval(parseISO(e.endTime), { start, end }));
  });
}

/**
 * Get daily sleep summary for a specific date
 */
export function getDailySummary(entries: SleepEntry[], date: Date): DailySummary {
  const dayEntries = getEntriesForDate(entries, date);
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  let totalSleepMs = 0;
  let nightSleepMs = 0;
  let napSleepMs = 0;
  let longestStretchMs = 0;
  let napCount = 0;

  for (const entry of dayEntries) {
    if (!entry.endTime) continue; // Skip ongoing sleep

    const entryStart = parseISO(entry.startTime);
    const entryEnd = parseISO(entry.endTime);

    // Clamp to day boundaries
    const clampedStart = isBefore(entryStart, dayStart) ? dayStart : entryStart;
    const clampedEnd = isAfter(entryEnd, dayEnd) ? dayEnd : entryEnd;

    if (isAfter(clampedStart, clampedEnd)) continue;

    const durationMs = differenceInMilliseconds(clampedEnd, clampedStart);
    totalSleepMs += durationMs;

    if (durationMs > longestStretchMs) {
      longestStretchMs = durationMs;
    }

    const sleepType = classifySleepType(entryStart);
    if (sleepType === 'night') {
      nightSleepMs += durationMs;
    } else {
      napSleepMs += durationMs;
      napCount++;
    }
  }

  return { totalSleepMs, napCount, longestStretchMs, nightSleepMs, napSleepMs };
}

/**
 * Get the currently active (ongoing) sleep entry
 */
export function getActiveSleep(entries: SleepEntry[]): SleepEntry | null {
  return entries.find((e) => e.endTime === null) ?? null;
}

/**
 * Determine the nap index (0=first nap today, 1=second nap today, etc.)
 * based on completed naps today
 */
function getNapIndexToday(entries: SleepEntry[], date: Date): number {
  const today = startOfDay(date);
  const tomorrow = endOfDay(date);
  const completedNapsToday = entries.filter((e) => {
    if (!e.endTime) return false;
    const start = parseISO(e.startTime);
    const type = classifySleepType(start);
    return type === 'nap' && isWithinInterval(start, { start: today, end: tomorrow });
  });
  return completedNapsToday.length;
}

/**
 * Get the next suggested sleep time and wake window info
 */
export function getNextSuggestedSleep(entries: SleepEntry[]): NextSleepSuggestion {
  const now = new Date();

  // Sort entries by start time desc
  const sorted = [...entries]
    .filter((e) => e.endTime !== null)
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  if (sorted.length === 0) {
    // No history — suggest bedtime tonight
    const bedtime = new Date();
    bedtime.setHours(BEDTIME_HOUR, 0, 0, 0);
    if (isBefore(bedtime, now)) {
      bedtime.setDate(bedtime.getDate() + 1);
    }
    return {
      suggestedTime: bedtime,
      label: 'Bedtime',
      minutesUntil: differenceInMinutes(bedtime, now),
      wakeWindowMinutes: WAKE_WINDOWS.afterNap2.ideal,
      urgency: 'waiting',
    };
  }

  const lastEntry = sorted[0];
  const lastWakeTime = parseISO(lastEntry.endTime!);
  const awakeMinutes = differenceInMinutes(now, lastWakeTime);

  // Figure out which wake window to use
  const napIndex = getNapIndexToday(entries, now);
  const lastSleepType = classifySleepType(lastEntry.startTime);

  let wakeWindow: { min: number; max: number; ideal: number };
  let nextLabel: string;

  if (lastSleepType === 'night' || napIndex === 0) {
    wakeWindow = WAKE_WINDOWS.afterNightSleep;
    nextLabel = 'Nap 1';
  } else if (napIndex === 1) {
    wakeWindow = WAKE_WINDOWS.afterNap1;
    nextLabel = 'Nap 2';
  } else {
    wakeWindow = WAKE_WINDOWS.afterNap2;
    nextLabel = 'Bedtime';
  }

  const suggestedTime = addMinutes(lastWakeTime, wakeWindow.ideal);
  const minutesUntil = differenceInMinutes(suggestedTime, now);

  let urgency: NextSleepSuggestion['urgency'];
  if (awakeMinutes >= wakeWindow.max) {
    urgency = 'overdue';
  } else if (awakeMinutes >= wakeWindow.ideal) {
    urgency = 'now';
  } else if (minutesUntil <= 15) {
    urgency = 'soon';
  } else {
    urgency = 'waiting';
  }

  return {
    suggestedTime,
    label: nextLabel,
    minutesUntil,
    wakeWindowMinutes: wakeWindow.ideal,
    urgency,
  };
}

/**
 * Format milliseconds as "Xh Ym" or "Ym" string
 */
export function formatDuration(ms: number): string {
  if (ms <= 0) return '0m';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/**
 * Format minutes as "Xh Ym"
 */
export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = Math.abs(minutes) % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Get data for weekly bar chart (last 7 days)
 */
export function getWeeklyData(entries: SleepEntry[]): Array<{
  date: string;
  label: string;
  totalHours: number;
  nightHours: number;
  napHours: number;
}> {
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const summary = getDailySummary(entries, d);
    const label = i === 0 ? 'Today' : i === 1 ? 'Yest' :
      d.toLocaleDateString('en', { weekday: 'short' });
    result.push({
      date: d.toISOString(),
      label,
      totalHours: Math.round((summary.totalSleepMs / 3600000) * 10) / 10,
      nightHours: Math.round((summary.nightSleepMs / 3600000) * 10) / 10,
      napHours: Math.round((summary.napSleepMs / 3600000) * 10) / 10,
    });
  }
  return result;
}

/**
 * Get timeline blocks for 24h view (for today or yesterday)
 */
export function getTimelineBlocks(entries: SleepEntry[], date: Date): Array<{
  startMinute: number; // minutes from midnight
  durationMinutes: number;
  type: 'night' | 'nap';
  label: string;
}> {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const blocks: Array<{ startMinute: number; durationMinutes: number; type: 'night' | 'nap'; label: string }> = [];

  for (const entry of entries) {
    const entryStart = parseISO(entry.startTime);
    const entryEnd = entry.endTime ? parseISO(entry.endTime) : new Date();

    // Clamp to day
    const clampedStart = isBefore(entryStart, dayStart) ? dayStart : entryStart;
    const clampedEnd = isAfter(entryEnd, dayEnd) ? dayEnd : entryEnd;

    // Check if this entry overlaps with the day
    if (isAfter(clampedStart, dayEnd) || isBefore(clampedEnd, dayStart)) continue;
    if (isAfter(clampedStart, clampedEnd)) continue;

    const startMinute = differenceInMinutes(clampedStart, dayStart);
    const durationMinutes = differenceInMinutes(clampedEnd, clampedStart);

    if (durationMinutes < 1) continue;

    blocks.push({
      startMinute,
      durationMinutes,
      type: classifySleepType(entryStart),
      label: formatDuration(durationMinutes * 60000),
    });
  }

  return blocks;
}

/**
 * Check if a nap is too long (exceeds 1.75 hours)
 */
export function isNapTooLong(entry: SleepEntry): boolean {
  if (entry.endTime !== null) return false;
  const type = classifySleepType(entry.startTime);
  if (type === 'night') return false;
  const start = parseISO(entry.startTime);
  const now = new Date();
  const minutes = differenceInMinutes(now, start);
  return minutes >= NAP_MAX_DURATION_MINUTES;
}

/**
 * Calculate baby age in months from birthdate string
 */
export function getBabyAgeMonths(birthdateStr: string): number {
  const birthdate = parseISO(birthdateStr);
  const now = new Date();
  const months =
    (now.getFullYear() - birthdate.getFullYear()) * 12 +
    (now.getMonth() - birthdate.getMonth());
  return Math.max(0, months);
}

/**
 * Get age label like "9 months", "1 year 2 months"
 */
export function getBabyAgeLabel(birthdateStr: string): string {
  const months = getBabyAgeMonths(birthdateStr);
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} old`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (remainingMonths === 0) return `${years} year${years !== 1 ? 's' : ''} old`;
  return `${years}y ${remainingMonths}m old`;
}
