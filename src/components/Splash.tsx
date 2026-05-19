import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

export default function Splash({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = window.setTimeout(() => setLeaving(true), 1800);
    const t2 = window.setTimeout(onDone, 2400);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-500 ${
        leaving ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        background:
          'radial-gradient(900px 600px at 50% 40%, rgba(168,85,247,0.25), transparent 60%), radial-gradient(700px 500px at 70% 60%, rgba(56,189,248,0.18), transparent 60%), #08070d',
      }}
    >
      <div className="splash-aura" />

      <div className="relative flex flex-col items-center gap-5 text-center">
        <div className="splash-logo h-20 w-20 rounded-2xl bg-accent-gradient flex items-center justify-center shadow-glow">
          <span className="font-display text-4xl font-extrabold text-white drop-shadow">P</span>
        </div>

        <div className="splash-title font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Playtika Art Studio
        </div>

        <div className="splash-sub text-sm text-ink-300 flex items-center gap-2">
          <Sparkles size={14} className="text-accent-400" />
          Generative creative for marketing
        </div>

        <div className="splash-bar mt-4 h-1 w-48 overflow-hidden rounded-full bg-white/5">
          <div className="h-full w-1/3 rounded-full bg-accent-gradient splash-bar-fill" />
        </div>
      </div>
    </div>
  );
}
