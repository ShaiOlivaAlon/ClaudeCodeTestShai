import { Sparkles, RefreshCw } from 'lucide-react';
import type { Suggestion } from '../types';
import Chip from './Chip';

interface Props {
  suggestions: Suggestion[];
  selectedIds: string[];
  loading: boolean;
  onToggle: (id: string) => void;
  onRefresh: () => void;
}

export default function Suggestions({
  suggestions,
  selectedIds,
  loading,
  onToggle,
  onRefresh,
}: Props) {
  const grouped = suggestions.reduce<Record<string, Suggestion[]>>((acc, s) => {
    const k = s.category || 'other';
    (acc[k] = acc[k] || []).push(s);
    return acc;
  }, {});

  return (
    <section className="card-pad space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-accent-400" />
          <div>
            <div className="section-title">Smart directions</div>
            <p className="mt-0.5 text-sm text-ink-300">
              Toggle creative directions to mix into every generation.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn-ghost"
          onClick={onRefresh}
          disabled={loading}
          title="Refresh suggestions"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </header>

      {loading && !suggestions.length && (
        <div className="grid sm:grid-cols-2 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-7 rounded-full skeleton" />
          ))}
        </div>
      )}

      {!loading && !suggestions.length && (
        <p className="text-sm text-ink-400">
          Fill the brief above, then refresh to get tailored directions.
        </p>
      )}

      {Object.entries(grouped).map(([cat, list]) => (
        <div key={cat} className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.16em] text-ink-400">{cat}</div>
          <div className="flex flex-wrap gap-1.5">
            {list.map((s) => (
              <Chip
                key={s.id}
                label={s.label}
                active={selectedIds.includes(s.id)}
                onClick={() => onToggle(s.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
