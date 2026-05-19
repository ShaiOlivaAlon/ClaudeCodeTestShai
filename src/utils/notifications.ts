import { SleepEntry, AppSettings } from '../types';
import { getNextSuggestedSleep, getActiveSleep, classifySleepType } from './sleepLogic';
import { differenceInMinutes, parseISO } from 'date-fns';

// Store pending notification timeouts so we can clear them
const pendingTimeouts: ReturnType<typeof setTimeout>[] = [];

/**
 * Request notification permission from the browser
 * Returns true if granted
 */
export async function requestPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

/**
 * Check if notifications are currently available
 */
export function notificationsAvailable(): boolean {
  return 'Notification' in window && Notification.permission === 'granted';
}

/**
 * Show a notification immediately (if permission granted)
 */
function showNotification(title: string, body: string, icon = '/icons/icon-192.png'): void {
  if (!notificationsAvailable()) return;
  try {
    new Notification(title, {
      body,
      icon,
      tag: 'baby-sleep',
    });
  } catch (err) {
    console.warn('Failed to show notification:', err);
  }
}

/**
 * Schedule a notification after a delay
 * Returns the timeout ID
 */
export function scheduleNotification(
  title: string,
  body: string,
  delayMs: number
): ReturnType<typeof setTimeout> | null {
  if (delayMs <= 0) {
    showNotification(title, body);
    return null;
  }

  const id = setTimeout(() => {
    showNotification(title, body);
  }, delayMs);

  pendingTimeouts.push(id);
  return id;
}

/**
 * Clear all pending scheduled notifications
 */
export function clearAllNotifications(): void {
  while (pendingTimeouts.length > 0) {
    const id = pendingTimeouts.pop();
    if (id !== undefined) clearTimeout(id);
  }
}

/**
 * Reschedule all relevant notifications based on current app state
 */
export function rescheduleNotifications(
  entries: SleepEntry[],
  settings: AppSettings
): void {
  clearAllNotifications();

  if (!settings.notificationsEnabled || !notificationsAvailable()) return;

  const now = new Date();
  const activeSleep = getActiveSleep(entries);

  if (activeSleep) {
    // Baby is sleeping — schedule wake alerts
    const sleepType = classifySleepType(activeSleep.startTime);

    if (sleepType === 'nap' && settings.alerts.longNap) {
      // Alert when nap exceeds 1h 45m (105 minutes)
      const sleepStart = parseISO(activeSleep.startTime);
      const napMaxMs = 105 * 60 * 1000;
      const elapsed = now.getTime() - sleepStart.getTime();
      const remaining = napMaxMs - elapsed;

      if (remaining > 0) {
        scheduleNotification(
          '⏰ Wake Baby Up',
          'Nap has exceeded 1h 45m. Time to wake the baby!',
          remaining
        );
      } else {
        // Already too long
        showNotification('⏰ Wake Baby Up', 'Nap has exceeded 1h 45m!');
      }
    }
  } else {
    // Baby is awake — schedule next sleep alerts
    const suggestion = getNextSuggestedSleep(entries);
    const minutesUntil = suggestion.minutesUntil;

    if (settings.alerts.wakeWindow) {
      // "Nap time soon" — 15 min before suggested
      if (minutesUntil > 15) {
        const soonMs = (minutesUntil - 15) * 60 * 1000;
        scheduleNotification(
          '😴 Nap Time Soon',
          `${suggestion.label} in about 15 minutes`,
          soonMs
        );
      }

      // "Time for a nap!" — at suggested time
      if (minutesUntil > 0) {
        const atTimeMs = minutesUntil * 60 * 1000;
        scheduleNotification(
          '💤 Time for a Nap!',
          `Wake window reached — time for ${suggestion.label}`,
          atTimeMs
        );
      }
    }

    // Bedtime reminder
    if (settings.alerts.bedtime && suggestion.label === 'Bedtime') {
      const bedtimeMinutes = differenceInMinutes(suggestion.suggestedTime, now);
      if (bedtimeMinutes > 30) {
        const reminderMs = (bedtimeMinutes - 30) * 60 * 1000;
        scheduleNotification(
          '🌙 Bedtime Soon',
          'Bedtime in 30 minutes — start the wind-down routine',
          reminderMs
        );
      }
    }
  }
}
