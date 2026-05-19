import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { format } from 'date-fns';
import { SleepEntry } from '../types';
import { classifySleepType } from '../utils/sleepLogic';
import { generateId } from '../utils/storage';

interface Props {
  entry: SleepEntry | null;
  onSave: (entry: SleepEntry) => void;
  onClose: () => void;
}

function toDatetimeLocal(isoString: string | null): string {
  if (!isoString) return '';
  try {
    return format(new Date(isoString), "yyyy-MM-dd'T'HH:mm");
  } catch {
    return '';
  }
}

function fromDatetimeLocal(value: string): string | null {
  if (!value) return null;
  try {
    return new Date(value).toISOString();
  } catch {
    return null;
  }
}

export default function EditEntryModal({ entry, onSave, onClose }: Props) {
  const isNew = entry === null;

  const [startValue, setStartValue] = useState('');
  const [endValue, setEndValue] = useState('');
  const [sleepType, setSleepType] = useState<'night' | 'nap' | 'manual'>('nap');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (entry) {
      setStartValue(toDatetimeLocal(entry.startTime));
      setEndValue(toDatetimeLocal(entry.endTime));
      setSleepType(entry.type);
      setNotes(entry.notes ?? '');
    } else {
      const now = format(new Date(), "yyyy-MM-dd'T'HH:mm");
      setStartValue(now);
      setEndValue('');
      setSleepType('nap');
      setNotes('');
    }
    setError('');
  }, [entry]);

  const handleStartChange = (v: string) => {
    setStartValue(v);
    if (v) {
      const detected = classifySleepType(new Date(v));
      setSleepType(detected);
    }
  };

  const handleSave = () => {
    if (!startValue) {
      setError('Start time is required');
      return;
    }
    const start = fromDatetimeLocal(startValue);
    if (!start) {
      setError('Invalid start time');
      return;
    }
    const end = endValue ? fromDatetimeLocal(endValue) : null;
    if (end && new Date(end) <= new Date(start)) {
      setError('End time must be after start time');
      return;
    }

    const saved: SleepEntry = {
      id: entry?.id ?? generateId(),
      startTime: start,
      endTime: end,
      type: sleepType,
      notes: notes.trim() || undefined,
    };
    onSave(saved);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl shadow-2xl p-6 pb-10 animate-in slide-in-from-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            {isNew ? 'Add Sleep Entry' : 'Edit Sleep Entry'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Start time */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Fell Asleep At
            </label>
            <input
              type="datetime-local"
              value={startValue}
              onChange={(e) => handleStartChange(e.target.value)}
              className="input-field"
            />
          </div>

          {/* End time */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Woke Up At
              <span className="ml-1 text-xs font-normal text-gray-400">(leave empty if still sleeping)</span>
            </label>
            <input
              type="datetime-local"
              value={endValue}
              onChange={(e) => setEndValue(e.target.value)}
              className="input-field"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Type</label>
            <div className="flex gap-2">
              {(['nap', 'night', 'manual'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setSleepType(t)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    sleepType === t
                      ? 'bg-primary-500 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t === 'nap' ? '☀️ Nap' : t === 'night' ? '🌙 Night' : '✏️ Manual'}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Notes <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Took a while to settle, woke up happy..."
              rows={2}
              className="input-field resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 font-medium">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button onClick={handleSave} className="btn-primary flex-1 flex items-center justify-center gap-2">
              <Save size={16} />
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
