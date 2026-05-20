import { Settings as SettingsIcon, Sparkles } from 'lucide-react';
import { useStore } from '../state/store';

export function Header() {
  const { state, dispatch } = useStore();
  const keys = state.settings.apiKeys;
  const ready = Boolean(keys.anthropic && keys.fal);

  return (
    <header className="flex items-center justify-between border-b border-ink-800 bg-ink-950 px-5 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient shadow-glow">
          <Sparkles size={18} className="text-white" />
        </div>
        <div>
          <div className="font-display text-base font-bold text-white">Playtika Artist Studio</div>
          <div className="text-[11px] text-ink-300">Generate marketing sets from your characters, items & IP</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${ready ? 'bg-emerald-500/15 text-emerald-200' : 'bg-amber-500/15 text-amber-200'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${ready ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          {ready ? 'Ready' : 'Add API keys'}
        </span>
        <button
          onClick={() => dispatch({ type: 'ui/openSettings', open: true })}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-700 px-3 py-1.5 text-xs font-medium text-ink-100 hover:border-ink-500 hover:bg-ink-800"
        >
          <SettingsIcon size={14} /> Settings
        </button>
      </div>
    </header>
  );
}
