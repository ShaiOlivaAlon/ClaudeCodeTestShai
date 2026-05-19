export interface SleepEntry {
  id: string;
  startTime: string; // ISO string
  endTime: string | null; // null = currently sleeping
  type: 'night' | 'nap' | 'manual';
  notes?: string;
}

export interface AppSettings {
  babyName: string;
  babyBirthdate: string; // ISO date string (YYYY-MM-DD)
  notificationsEnabled: boolean;
  alerts: {
    wakeWindow: boolean;
    bedtime: boolean;
    longNap: boolean;
  };
}

export interface DailySummary {
  totalSleepMs: number;
  napCount: number;
  longestStretchMs: number;
  nightSleepMs: number;
  napSleepMs: number;
}

export interface NextSleepSuggestion {
  suggestedTime: Date;
  label: string;
  minutesUntil: number;
  wakeWindowMinutes: number;
  urgency: 'soon' | 'now' | 'overdue' | 'waiting';
}

export type TabName = 'dashboard' | 'history' | 'charts' | 'settings';

export type AppAction =
  | { type: 'START_SLEEP' }
  | { type: 'STOP_SLEEP' }
  | { type: 'ADD_ENTRY'; entry: SleepEntry }
  | { type: 'UPDATE_ENTRY'; entry: SleepEntry }
  | { type: 'DELETE_ENTRY'; id: string }
  | { type: 'SET_ENTRIES'; entries: SleepEntry[] };

export interface AppState {
  entries: SleepEntry[];
  settings: AppSettings;
}
