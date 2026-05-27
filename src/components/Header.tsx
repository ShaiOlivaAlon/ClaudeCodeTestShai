import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Folder, FolderPlus, Settings as SettingsIcon, Sparkles, Trash2 } from 'lucide-react';
import { useStore } from '../state/store';
import { cls, uid } from '../lib/utils';
import { deleteProject, putProject } from '../lib/storage';
import type { Project } from '../types';

const PROJECT_COLORS = ['#a875ff', '#5fc4ff', '#7be3a9', '#ffb86b', '#ff6e9a', '#ffd959', '#9affd9'];

export function Header() {
  const { state, dispatch } = useStore();
  const keys = state.settings.apiKeys;
  const ready = Boolean(keys.text?.key && keys.image?.key && keys.video?.key);
  const activeProject = state.projects.find((p) => p.id === state.activeProjectId) ?? null;

  // Persist the active project across reloads.
  useEffect(() => {
    try {
      if (state.activeProjectId) localStorage.setItem('pas.activeProjectId', state.activeProjectId);
      else localStorage.removeItem('pas.activeProjectId');
    } catch { /* ignore */ }
  }, [state.activeProjectId]);

  return (
    <header className="flex items-center justify-between gap-2 border-b border-ink-800 bg-ink-950 px-3 py-2 sm:px-5 sm:py-3">
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
        <ProjectSwitcher active={activeProject} />
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

function ProjectSwitcher({ active }: { active: Project | null }) {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState('');
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click / Esc.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function pick(id: string | null) {
    dispatch({ type: 'projects/setActive', id });
    setOpen(false);
    setCreating(false);
    setDraftName('');
  }

  async function createAndSelect() {
    const name = draftName.trim();
    if (!name) return;
    const color = PROJECT_COLORS[state.projects.length % PROJECT_COLORS.length];
    const now = Date.now();
    const p: Project = { id: uid('proj'), name, color, createdAt: now, updatedAt: now };
    dispatch({ type: 'projects/upsert', project: p });
    try { await putProject(p); } catch { /* */ }
    dispatch({ type: 'projects/setActive', id: p.id });
    dispatch({ type: 'ui/toast', toast: { kind: 'success', message: `Project "${name}" created — new renders will be filed here.` } });
    setOpen(false);
    setCreating(false);
    setDraftName('');
  }

  async function remove(e: React.MouseEvent, p: Project) {
    e.stopPropagation();
    if (!confirm(`Delete project "${p.name}"? Generations stay; they just become unfiled.`)) return;
    try { await deleteProject(p.id); } catch { /* */ }
    dispatch({ type: 'projects/remove', id: p.id });
  }

  const swatch = active ? active.color : '#9CA3AF';
  const label = active ? active.name : 'All projects';

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex max-w-[10rem] items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-900/70 px-2 py-1.5 text-xs font-medium text-ink-100 hover:border-ink-500 hover:bg-ink-800 sm:max-w-[14rem]"
        title="Switch project"
      >
        <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: swatch }} />
        <span className="truncate">{label}</span>
        <ChevronDown size={12} className={cls('shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.12 }}
          className="absolute right-0 z-50 mt-1.5 w-72 origin-top-right overflow-hidden rounded-lg border border-ink-700 bg-ink-900 shadow-soft"
        >
          <button
            onClick={() => pick(null)}
            className={cls(
              'flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition',
              active === null ? 'bg-brand-500/15 text-white' : 'text-ink-200 hover:bg-ink-800',
            )}
          >
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-ink-500" />
            <span className="flex-1">All projects</span>
            <span className="text-[10px] text-ink-500">no filter</span>
          </button>
          <div className="max-h-72 overflow-y-auto border-t border-ink-800">
            {state.projects.length === 0 ? (
              <div className="px-3 py-3 text-[11px] text-ink-400">
                No projects yet. Create one to group your renders.
              </div>
            ) : (
              state.projects.map((p) => (
                <div key={p.id} className={cls('group flex items-center gap-2 px-3 py-2 text-xs transition', active?.id === p.id ? 'bg-brand-500/10 text-white' : 'text-ink-200 hover:bg-ink-800')}>
                  <button onClick={() => pick(p.id)} className="flex flex-1 items-center gap-2 text-left">
                    <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
                    <span className="truncate">{p.name}</span>
                  </button>
                  <button onClick={(e) => remove(e, p)} className="opacity-0 transition group-hover:opacity-100" title="Delete project">
                    <Trash2 size={12} className="text-ink-400 hover:text-rose-300" />
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-ink-800 p-2">
            {creating ? (
              <div className="flex items-center gap-1.5">
                <Folder size={14} className="text-brand-300" />
                <input
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); createAndSelect(); }
                    if (e.key === 'Escape') { setCreating(false); setDraftName(''); }
                  }}
                  placeholder='e.g. "Slot launch — September"'
                  className="w-full rounded-md border border-ink-600 bg-ink-900 px-2 py-1 text-xs text-ink-100 outline-none focus:border-brand-400"
                />
                <button onClick={createAndSelect} className="rounded-md bg-brand-500 px-2 py-1 text-[11px] font-semibold text-white hover:brightness-110">
                  Create
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-ink-700 px-2 py-1.5 text-[11px] text-ink-200 hover:border-brand-400 hover:text-white"
              >
                <FolderPlus size={12} /> New project
              </button>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
