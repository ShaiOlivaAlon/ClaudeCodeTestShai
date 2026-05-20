import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Chip } from './ui';

export function TagCloud({
  selected,
  presets = [],
  onToggle,
  onAddCustom,
  placeholder = 'Add custom…',
  allowCustom = true,
}: {
  selected: string[];
  presets?: string[];
  onToggle: (value: string) => void;
  onAddCustom?: (value: string) => void;
  placeholder?: string;
  allowCustom?: boolean;
}) {
  const [draft, setDraft] = useState('');

  function commit() {
    const v = draft.trim();
    if (!v) return;
    if (!selected.includes(v)) {
      if (onAddCustom) onAddCustom(v);
      else onToggle(v);
    }
    setDraft('');
  }

  // Selected values that are not in presets (custom ones) — render together at the top.
  const customSelected = selected.filter((s) => !presets.includes(s));
  const orderedPresets = presets.length ? presets : selected;

  return (
    <div className="space-y-2">
      {customSelected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {customSelected.map((s) => (
            <Chip key={s} active onClick={() => onToggle(s)} onRemove={() => onToggle(s)}>{s}</Chip>
          ))}
        </div>
      )}
      {orderedPresets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {orderedPresets.map((p) => (
            <Chip key={p} active={selected.includes(p)} onClick={() => onToggle(p)}>{p}</Chip>
          ))}
        </div>
      )}
      {allowCustom && (
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                commit();
              }
            }}
            placeholder={placeholder}
            className="flex-1 rounded-lg border border-ink-600 bg-ink-900 px-3 py-1.5 text-xs text-ink-100 placeholder-ink-400 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/30"
          />
          <button
            type="button"
            onClick={commit}
            className="inline-flex items-center gap-1 rounded-lg border border-ink-600 px-2 py-1.5 text-xs text-ink-200 hover:border-brand-400 hover:text-white"
          >
            <Plus size={12} /> Add
          </button>
        </div>
      )}
    </div>
  );
}
