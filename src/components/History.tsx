import React, { useState } from 'react';
import { Pencil, Trash2, Plus, Moon, Sun, ChevronRight } from 'lucide-react';
import { SleepEntry } from '../types';
import { formatDuration, classifySleepType } from '../utils/sleepLogic';
import { parseISO, format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';

interface HistoryProps {
  entries: SleepEntry[];
  onEdit: (entry: SleepEntry) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

function getDateLabel(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEEE, MMM d');
}

function groupEntriesByDay(entries: SleepEntry[]): Array<{
  dateLabel: string;
  dateKey: string;
  entries: SleepEntry[];
}> {
  const groups = new Map<string, SleepEntry[]>();

  const sorted = [...entries].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );

  for (const entry of sorted) {
    const key = format(parseISO(entry.startTime), 'yyyy-MM-dd');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }

  return Array.from(groups.entries()).map(([key, es]) => ({
    dateKey: key,
    dateLabel: getDateLabel(es[0].startTime),
    entries: es,
  }));
}

function getNapLabel(entry: SleepEntry, dayEntries: SleepEntry[]): string {
  const sleepType = classifySleepType(entry.startTime);
  if (sleepType === 'night') return 'Night Sleep';
  const naps = dayEntries.filter(
    (e) => classifySleepType(e.startTime) === 'nap'
  );
  const idx = naps.findIndex((e) => e.id === entry.id);
  return `Nap ${idx + 1}`;
}

export default function History({ entries, onEdit, onDelete, onAdd }: HistoryProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const groups = groupEntriesByDay(entries);

  const handleDelete = (id: string) => {
    if (deletingId === id) {
      onDelete(id);
      setDeletingId(null);
    } else {
      setDeletingId(id);
      // Auto-cancel confirm after 3s
      setTimeout(() => setDeletingId(null), 3000);
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-4 pt-12 pb-4 bg-gradient-to-b from-primary-500 to-primary-600">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-xl">Sleep History</h1>
            <p className="text-white/70 text-sm mt-0.5">
              {entries.length} total {entries.length === 1 ? 'session' : 'sessions'}
            </p>
          </div>
          <button
            onClick={onAdd}
            className="bg-white/20 hover:bg-white/30 active:bg-white/40 text-white font-semibold
                       px-4 py-2 rounded-xl text-sm transition-all duration-150 active:scale-95
                       flex items-center gap-1.5"
          >
            <Plus size={16} />
            Add
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-4">
        {groups.length === 0 ? (
          <EmptyState onAdd={onAdd} />
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.dateKey}>
                {/* Day header */}
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {group.dateLabel}
                  </span>
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-xs text-gray-300">
                    {group.entries.length} session{group.entries.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Entries */}
                <div className="card overflow-hidden divide-y divide-gray-50">
                  {group.entries.map((entry) => (
                    <HistoryEntryRow
                      key={entry.id}
                      entry={entry}
                      label={getNapLabel(entry, group.entries)}
                      isDeleting={deletingId === entry.id}
                      onEdit={() => onEdit(entry)}
                      onDelete={() => handleDelete(entry.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── History Entry Row ────────────────────────────────────────────────────────

interface HistoryEntryRowProps {
  entry: SleepEntry;
  label: string;
  isDeleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function HistoryEntryRow({ entry, label, isDeleting, onEdit, onDelete }: HistoryEntryRowProps) {
  const start = parseISO(entry.startTime);
  const end = entry.endTime ? parseISO(entry.endTime) : null;
  const isActive = entry.endTime === null;
  const sleepType = classifySleepType(entry.startTime);
  const isNight = sleepType === 'night';

  const duration = end ? end.getTime() - start.getTime() : null;

  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${isDeleting ? 'bg-red-50' : ''}`}>
      {/* Type icon */}
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
          isNight ? 'bg-indigo-900/10' : 'bg-primary-50'
        }`}
      >
        {isNight ? (
          <Moon size={16} className="text-indigo-900" fill="currentColor" />
        ) : (
          <Sun size={16} className="text-amber-500" />
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">{label}</span>
          {isActive && (
            <span className="text-[10px] font-medium bg-primary-100 text-primary-600 px-1.5 py-0.5 rounded-full">
              Live
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          {format(start, 'h:mm a')}
          {end ? ` – ${format(end, 'h:mm a')}` : ' – ongoing'}
          {duration && (
            <span className="ml-2 text-gray-400">· {formatDuration(duration)}</span>
          )}
        </div>
        {entry.notes && (
          <div className="text-xs text-gray-400 mt-0.5 italic truncate">"{entry.notes}"</div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onEdit}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400
                     hover:text-primary-500 hover:bg-primary-50 transition-all duration-150"
          aria-label="Edit"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={onDelete}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 ${
            isDeleting
              ? 'text-white bg-red-500 hover:bg-red-600'
              : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
          }`}
          aria-label={isDeleting ? 'Confirm delete' : 'Delete'}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center mb-4">
        <Moon size={32} className="text-primary-300" />
      </div>
      <h3 className="text-gray-700 font-semibold text-lg mb-1">No sleep sessions yet</h3>
      <p className="text-gray-400 text-sm mb-6">
        Start tracking by using the Dashboard, or add a session manually.
      </p>
      <button
        onClick={onAdd}
        className="bg-primary-500 text-white font-semibold px-6 py-3 rounded-2xl
                   hover:bg-primary-600 active:scale-95 transition-all duration-150
                   flex items-center gap-2"
      >
        <Plus size={16} />
        Add First Session
      </button>
    </div>
  );
}
