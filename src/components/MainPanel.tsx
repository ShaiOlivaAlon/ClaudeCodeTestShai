import { useState } from 'react';
import { Layers, Wand2 } from 'lucide-react';
import { BriefBuilder } from './BriefBuilder';
import { GameFeature } from './GameFeature';
import { cls } from '../lib/utils';

type MainMode = 'brief' | 'game';

/** Wraps the middle column with a mode switcher so the user can flip between the
 *  ideation brief and the Game Feature project editor without losing either's state. */
export function MainPanel() {
  const [mode, setMode] = useState<MainMode>('brief');
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-1 border-b border-ink-800 bg-ink-950/60 px-2 py-1.5">
        <ModeTab
          active={mode === 'brief'}
          onClick={() => setMode('brief')}
          icon={<Wand2 size={14} />}
          label="Brief"
        />
        <ModeTab
          active={mode === 'game'}
          onClick={() => setMode('game')}
          icon={<Layers size={14} />}
          label="Game feature"
        />
      </div>
      <div className="min-h-0 flex-1">
        {mode === 'brief' ? <BriefBuilder /> : <GameFeature />}
      </div>
    </div>
  );
}

function ModeTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cls(
        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition active:scale-95',
        active ? 'bg-brand-500/20 text-white shadow-[inset_0_0_0_1px_rgba(168,117,255,0.4)]' : 'text-ink-400 hover:text-white',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
