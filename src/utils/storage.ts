import { SleepEntry, AppSettings } from '../types';
import { subMonths, formatISO, startOfDay } from 'date-fns';

const ENTRIES_KEY = 'baby_sleep_entries';
const SETTINGS_KEY = 'baby_sleep_settings';

function getDefaultBirthdate(): string {
  const nineMonthsAgo = subMonths(new Date(), 9);
  return formatISO(startOfDay(nineMonthsAgo), { representation: 'date' });
}

const DEFAULT_SETTINGS: AppSettings = {
  babyName: 'Baby',
  babyBirthdate: getDefaultBirthdate(),
  notificationsEnabled: false,
  alerts: {
    wakeWindow: true,
    bedtime: true,
    longNap: true,
  },
};

export function loadEntries(): SleepEntry[] {
  try {
    const raw = localStorage.getItem(ENTRIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SleepEntry[];
  } catch {
    return [];
  }
}

export function saveEntries(entries: SleepEntry[]): void {
  try {
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  } catch (err) {
    console.error('Failed to save entries:', err);
  }
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    // Merge with defaults in case new fields were added
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      alerts: {
        ...DEFAULT_SETTINGS.alerts,
        ...(parsed.alerts || {}),
      },
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
