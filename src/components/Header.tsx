import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Sparkles } from 'lucide-react';
import { useStore } from '../state/store';

export function Header() {
  const { state, dispatch } = useStore();
  const keys = state.settings.apiKeys;
  const ready = Boolean(keys.text?.key && keys.image?.key && keys.video?.key);

  return (
    <header className="flex items-center justify-between border-b border-ink-800 bg-ink-950 px-3 py-2 sm:px-5 sm:py-3">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <motion.div
          initial={{ scale: 0.6, rotate: -20, opacity: 0 }}
          animate={{ scale: [0.6, 1.15, 1], rotate: [-20, 8, 0], opacity: 1 }}
          transition={{ duration: 0.7, ease: 'easeOut', times: [0, 0.6, 1] }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-gradient shadow-glow sm:h-9 sm:w-9"
        >
          <Sparkles size={16} className="text-white sm:hidden" />
          <Sparkles size={18} className="hidden text-white sm:block" />
        </motion.div>
        <div className="min-w-0">
          <div className="truncate font-display text-sm font-bold text-white sm:text-base">Playtika Artist Studio</div>
          <div className="hidden truncate text-[11px] text-ink-300 sm:block">Generate marketing sets from your characters, items & IP</div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium sm:px-2.5 sm:text-[11px] ${ready ? 'bg-emerald-500/15 text-emerald-200' : 'bg-amber-500/15 text-amber-200'}`}
          title={ready ? 'API keys configured' : 'Add API keys in Settings'}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${ready ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          <span className="hidden sm:inline">{ready ? 'Ready' : 'Add API keys'}</span>
        </span>
        <button
          onClick={() => dispatch({ type: 'ui/openSettings', open: true })}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-700 px-2 py-1.5 text-xs font-medium text-ink-100 hover:border-ink-500 hover:bg-ink-800 sm:px-3"
          title="Settings"
        >
          <SettingsIcon size={14} /> <span className="hidden sm:inline">Settings</span>
        </button>
      </div>
    </header>
  );
}
