import React, { useState, useEffect } from 'react';
import { Moon } from 'lucide-react';
import { SleepEntry } from '../types';
import { parseISO, differenceInSeconds } from 'date-fns';
import { classifySleepType } from '../utils/sleepLogic';

interface ActiveSleepBannerProps {
  activeSleep: SleepEntry;
  onWakeUp: () => void;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export default function ActiveSleepBanner({ activeSleep, onWakeUp }: ActiveSleepBannerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = parseISO(activeSleep.startTime);
    const update = () => {
      setElapsed(differenceInSeconds(new Date(), start));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [activeSleep.startTime]);

  const sleepType = classifySleepType(activeSleep.startTime);
  const isNight = sleepType === 'night';

  return (
    <div
      className={`mx-4 mt-4 rounded-2xl p-4 flex items-center gap-4 ${
        isNight
          ? 'bg-gradient-to-r from-indigo-900 to-indigo-800 text-white'
          : 'bg-gradient-to-r from-primary-500 to-primary-600 text-white'
      }`}
    >
      {/* Pulsing moon icon */}
      <div className="relative flex-shrink-0">
        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center sleep-pulse">
          <Moon size={24} className="text-white" fill="currentColor" />
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-white/70 uppercase tracking-wide">
          {isNight ? 'Night Sleep' : 'Napping'}
        </div>
        <div className="text-2xl font-bold font-mono tracking-tight leading-tight">
          {formatElapsed(elapsed)}
        </div>
      </div>

      {/* Wake button */}
      <button
        onClick={onWakeUp}
        className="flex-shrink-0 bg-white/20 hover:bg-white/30 active:bg-white/40 text-white font-semibold
                   px-4 py-2 rounded-xl text-sm transition-all duration-150 active:scale-95"
      >
        Woke Up
      </button>
    </div>
  );
}
