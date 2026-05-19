import React, { useState, useEffect } from 'react';
import { Moon, Sun, Clock, Baby, TrendingUp, ZapOff } from 'lucide-react';
import { SleepEntry, AppSettings } from '../types';
import {
  getActiveSleep,
  getDailySummary,
  getNextSuggestedSleep,
  formatDuration,
  formatMinutes,
  getBabyAgeLabel,
} from '../utils/sleepLogic';
import { parseISO, differenceInSeconds, differenceInMinutes, format } from 'date-fns';
import ActiveSleepBanner from './ActiveSleepBanner';

interface DashboardProps {
  entries: SleepEntry[];
  settings: AppSettings;
  activeSleep: SleepEntry | null;
  onStartSleep: () => void;
  onStopSleep: () => void;
}

function formatElapsedFull(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m awake`;
  return `${m}m awake`;
}

export default function Dashboard({
  entries,
  settings,
  activeSleep,
  onStartSleep,
  onStopSleep,
}: DashboardProps) {
  const [now, setNow] = useState(new Date());

  // Tick every second for the live timer
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const today = new Date();
  const summary = getDailySummary(entries, today);
  const suggestion = activeSleep ? null : getNextSuggestedSleep(entries);

  // Calculate time awake since last wake-up
  const lastCompletedEntry = entries
    .filter((e) => e.endTime !== null)
    .sort((a, b) => new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime())[0];

  const awakeSinceSeconds = lastCompletedEntry && !activeSleep
    ? differenceInSeconds(now, parseISO(lastCompletedEntry.endTime!))
    : 0;

  const ageLabel = getBabyAgeLabel(settings.babyBirthdate);

  // Urgency color for suggestion
  const urgencyColor = {
    waiting: 'text-gray-500',
    soon: 'text-amber-500',
    now: 'text-primary-600',
    overdue: 'text-red-500',
  };
  const urgencyBg = {
    waiting: 'bg-gray-50 border-gray-100',
    soon: 'bg-amber-50 border-amber-100',
    now: 'bg-primary-50 border-primary-100',
    overdue: 'bg-red-50 border-red-100',
  };

  return (
    <div className="flex flex-col min-h-full px-0 pb-4">
      {/* Header */}
      <div className="px-4 pt-12 pb-4 bg-gradient-to-b from-primary-500 to-primary-600">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <Baby size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-xl leading-tight">
              {settings.babyName}
            </h1>
            <p className="text-white/70 text-xs">{ageLabel}</p>
          </div>
          <div className="ml-auto text-right">
            <div className="text-white font-mono text-lg font-semibold">
              {format(now, 'h:mm')}
            </div>
            <div className="text-white/60 text-xs">{format(now, 'aaa')}</div>
          </div>
        </div>
      </div>

      {/* Active sleep banner or awake status */}
      {activeSleep ? (
        <ActiveSleepBanner activeSleep={activeSleep} onWakeUp={onStopSleep} />
      ) : (
        <div className="mx-4 mt-4 card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
            <Sun size={24} className="text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Awake</div>
            <div className="text-lg font-bold text-gray-800">
              {lastCompletedEntry
                ? formatElapsedFull(awakeSinceSeconds)
                : 'No sleep logged yet'}
            </div>
            {lastCompletedEntry && (
              <div className="text-xs text-gray-400 mt-0.5">
                Woke at {format(parseISO(lastCompletedEntry.endTime!), 'h:mm a')}
              </div>
            )}
          </div>
          <button
            onClick={onStartSleep}
            className="flex-shrink-0 bg-primary-500 hover:bg-primary-600 active:bg-primary-700
                       text-white font-semibold px-4 py-2 rounded-xl text-sm
                       transition-all duration-150 active:scale-95 flex items-center gap-1.5"
          >
            <Moon size={14} />
            Sleep
          </button>
        </div>
      )}

      {/* Next suggestion */}
      {suggestion && (
        <div
          className={`mx-4 mt-3 rounded-2xl p-4 border ${urgencyBg[suggestion.urgency]}`}
        >
          <div className="flex items-center gap-3">
            <Clock size={18} className={urgencyColor[suggestion.urgency]} />
            <div className="flex-1">
              <div className={`font-semibold text-sm ${urgencyColor[suggestion.urgency]}`}>
                {suggestion.urgency === 'overdue'
                  ? `${suggestion.label} overdue!`
                  : suggestion.urgency === 'now'
                  ? `Time for ${suggestion.label}!`
                  : suggestion.urgency === 'soon'
                  ? `${suggestion.label} in ${Math.max(0, suggestion.minutesUntil)}m`
                  : `${suggestion.label} in ${formatMinutes(Math.max(0, suggestion.minutesUntil))}`}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Suggested at {format(suggestion.suggestedTime, 'h:mm a')} •{' '}
                {suggestion.wakeWindowMinutes}m wake window
              </div>
            </div>
            {(suggestion.urgency === 'now' || suggestion.urgency === 'overdue') && !activeSleep && (
              <button
                onClick={onStartSleep}
                className="bg-primary-500 text-white text-xs font-semibold px-3 py-1.5 rounded-xl
                           hover:bg-primary-600 active:scale-95 transition-all duration-150"
              >
                Start
              </button>
            )}
          </div>
        </div>
      )}

      {/* Today's summary */}
      <div className="mx-4 mt-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">
          Today's Summary
        </h2>
        <div className="grid grid-cols-3 gap-2">
          <SummaryCard
            icon={<Moon size={16} className="text-primary-500" />}
            label="Total Sleep"
            value={formatDuration(summary.totalSleepMs)}
            sub="Goal: 14h"
            highlight={summary.totalSleepMs > 12 * 3600000}
          />
          <SummaryCard
            icon={<ZapOff size={16} className="text-amber-500" />}
            label="Naps"
            value={String(summary.napCount)}
            sub={summary.napCount === 1 ? '1 nap' : `${summary.napCount} naps`}
          />
          <SummaryCard
            icon={<TrendingUp size={16} className="text-green-500" />}
            label="Longest"
            value={formatDuration(summary.longestStretchMs)}
            sub="Stretch"
          />
        </div>
      </div>

      {/* Quick action buttons */}
      {!activeSleep && (
        <div className="mx-4 mt-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onStartSleep}
              className="card p-4 flex flex-col items-center gap-2 active:scale-95 transition-all duration-150
                         hover:shadow-md border-primary-100 hover:border-primary-200"
            >
              <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center">
                <Moon size={20} className="text-primary-500" />
              </div>
              <span className="text-sm font-semibold text-gray-700">Fell Asleep</span>
              <span className="text-xs text-gray-400">Mark as sleeping</span>
            </button>
            <button
              onClick={() => {}} // placeholder — only active if sleeping
              disabled
              className="card p-4 flex flex-col items-center gap-2 opacity-40"
            >
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                <Sun size={20} className="text-amber-400" />
              </div>
              <span className="text-sm font-semibold text-gray-700">Woke Up</span>
              <span className="text-xs text-gray-400">Mark as awake</span>
            </button>
          </div>
        </div>
      )}

      {activeSleep && (
        <div className="mx-4 mt-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onStartSleep}
              disabled
              className="card p-4 flex flex-col items-center gap-2 opacity-40"
            >
              <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center">
                <Moon size={20} className="text-primary-500" />
              </div>
              <span className="text-sm font-semibold text-gray-700">Fell Asleep</span>
              <span className="text-xs text-gray-400">Mark as sleeping</span>
            </button>
            <button
              onClick={onStopSleep}
              className="card p-4 flex flex-col items-center gap-2 active:scale-95 transition-all duration-150
                         hover:shadow-md border-amber-100 hover:border-amber-200"
            >
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                <Sun size={20} className="text-amber-500" />
              </div>
              <span className="text-sm font-semibold text-gray-700">Woke Up</span>
              <span className="text-xs text-gray-400">Mark as awake</span>
            </button>
          </div>
        </div>
      )}

      {/* Recent sleep entries */}
      {entries.length > 0 && (
        <div className="mx-4 mt-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">
            Recent
          </h2>
          <div className="card divide-y divide-gray-50">
            {entries.slice(0, 3).map((entry) => (
              <RecentEntry key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}

function SummaryCard({ icon, label, value, sub, highlight }: SummaryCardProps) {
  return (
    <div className={`card p-3 flex flex-col gap-1 ${highlight ? 'border-green-100' : ''}`}>
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <div className="text-xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-[10px] text-gray-400">{sub}</div>}
    </div>
  );
}

// ─── Recent Entry ─────────────────────────────────────────────────────────────

function RecentEntry({ entry }: { entry: SleepEntry }) {
  const start = parseISO(entry.startTime);
  const end = entry.endTime ? parseISO(entry.endTime) : null;
  const isActive = entry.endTime === null;

  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <div
        className={`w-2 h-2 rounded-full flex-shrink-0 ${
          isActive ? 'bg-primary-500 animate-pulse' : 'bg-gray-300'
        }`}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800">
          {format(start, 'h:mm a')}
          {end && ` – ${format(end, 'h:mm a')}`}
          {isActive && <span className="text-primary-500"> (sleeping)</span>}
        </div>
        <div className="text-xs text-gray-400">
          {entry.type === 'night' ? 'Night Sleep' : 'Nap'}
          {end && ` · ${formatDuration(end.getTime() - start.getTime())}`}
        </div>
      </div>
    </div>
  );
}
