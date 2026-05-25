import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Box, Download, FileImage, Image as ImageIcon, Layers, Plus, Save, Sparkles, Trash2, X,
} from 'lucide-react';
import { useStore } from '../state/store';
import { ASPECT_RATIOS } from '../lib/models';
import { SCULPTURE_MATERIALS, findMaterial } from '../lib/materials';
import { generateImage, generateImageInpaint } from '../lib/api';
import { deleteGameProject, putGameProject } from '../lib/storage';
import { exportGameProjectZip } from '../lib/projectExport';
import { cls, uid } from '../lib/utils';
import type { AspectRatio, GameLayer, GameProject } from '../types';
import { Button, Card, Field, SectionHeader, Select, Spinner, TextInput, Textarea } from './ui';
import { MaskCanvas, type MaskCanvasHandle } from './MaskCanvas';

function emptyProject(): GameProject {
  const now = Date.now();
  return {
    id: uid('proj'),
    name: 'Untitled project',
    createdAt: now,
    updatedAt: now,
    aspectRatio: '1:1',
    material: 'marble',
    sculptureSubject: '',
    backgroundPrompt: '',
    sculptureLayers: [],
  };
}

/** Top-level panel: lists existing projects, lets the user start a new one,
 *  or opens the editor for the active project. */
export function GameFeature() {
  const { state, dispatch } = useStore();
  const active = state.gameProjects.find((p) => p.id === state.activeGameProjectId);

  function newProject() {
    const p = emptyProject();
    dispatch({ type: 'gameProjects/upsert', project: p });
    dispatch({ type: 'gameProjects/setActive', id: p.id });
    putGameProject(p).catch(() => {});
  }

  if (active) {
    return <ProjectEditor key={active.id} project={active} onBack={() => dispatch({ type: 'gameProjects/setActive', id: null })} />;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-ink-800 px-3 py-2 sm:px-5 sm:py-3">
        <div className="min-w-0">
          <div className="font-display text-sm font-semibold uppercase tracking-wider text-ink-100">Game feature</div>
          <div className="truncate text-xs text-ink-400">Sculpture-cutting projects: background + material + layered sculpture states.</div>
        </div>
        <Button size="sm" onClick={newProject}><Plus size={14} /> New project</Button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
        {state.gameProjects.length === 0 ? (
          <Card className="border-dashed">
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <Layers size={28} className="text-brand-300" />
              <div className="text-sm font-medium text-white">No projects yet</div>
              <p className="max-w-md text-xs text-ink-400">
                Each game project bundles a background image and a sequence of sculpture states — players
                "cut" through the states in your game. Create one to start.
              </p>
              <Button size="sm" onClick={newProject}><Plus size={14} /> New project</Button>
            </div>
          </Card>
        ) : (
          state.gameProjects.map((p) => <ProjectRow key={p.id} project={p} />)
        )}
      </div>
    </div>
  );
}

function ProjectRow({ project }: { project: GameProject }) {
  const { dispatch } = useStore();
  const sculptureCount = project.sculptureLayers.length;
  const thumb = project.background?.imageUrl || project.sculptureLayers[0]?.imageUrl;

  async function remove(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete project "${project.name}"?`)) return;
    await deleteGameProject(project.id);
    dispatch({ type: 'gameProjects/remove', id: project.id });
  }

  return (
    <button
      onClick={() => dispatch({ type: 'gameProjects/setActive', id: project.id })}
      className="group flex w-full items-center gap-3 rounded-lg border border-ink-700 bg-ink-850 p-3 text-left transition hover:border-brand-400/60 hover:bg-ink-800"
    >
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-ink-700 bg-ink-900">
        {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-ink-500"><ImageIcon size={18} /></div>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-white">{project.name}</div>
        <div className="truncate text-[11px] text-ink-400">
          {findMaterial(project.material)?.label ?? project.material} · {sculptureCount} state{sculptureCount === 1 ? '' : 's'} · {project.aspectRatio}
        </div>
      </div>
      <button
        onClick={remove}
        className="opacity-0 transition group-hover:opacity-100"
        title="Delete project"
      >
        <Trash2 size={14} className="text-rose-300 hover:text-rose-200" />
      </button>
    </button>
  );
}

// --- Project editor --------------------------------------------------------

function ProjectEditor({ project: initial, onBack }: { project: GameProject; onBack: () => void }) {
  const { state, dispatch } = useStore();
  const [project, setProject] = useState<GameProject>(initial);
  const [activeLayerIdx, setActiveLayerIdx] = useState<number>(initial.sculptureLayers.length ? 0 : -1);
  const [cutOpen, setCutOpen] = useState(false);

  const apiKeys = state.settings.apiKeys;
  const imageProvider = apiKeys.image?.provider;
  const canInpaint = imageProvider === 'fal';

  // Persist to IDB + reducer whenever the project changes.
  function commit(next: GameProject) {
    const updated = { ...next, updatedAt: Date.now() };
    setProject(updated);
    dispatch({ type: 'gameProjects/upsert', project: updated });
    putGameProject(updated).catch(() => {});
  }

  function update<K extends keyof GameProject>(patch: Pick<GameProject, K>) {
    commit({ ...project, ...patch });
  }

  async function generateBackground() {
    if (!project.backgroundPrompt.trim()) {
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: 'Describe the background first.' } });
      return;
    }
    if (!apiKeys.image?.key) {
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: 'Add an Image API key in Settings.' } });
      dispatch({ type: 'ui/openSettings', open: true });
      return;
    }
    const model = state.brief.imageModel;
    const layer: GameLayer = {
      id: uid('layer'),
      kind: 'background',
      index: 0,
      prompt: project.backgroundPrompt.trim(),
      imageModel: model,
      status: 'generating',
      createdAt: Date.now(),
    };
    commit({ ...project, background: layer });
    try {
      const { url } = await generateImage({
        apiKeys,
        model,
        prompt: layer.prompt,
        aspectRatio: project.aspectRatio,
      });
      commit({ ...project, background: { ...layer, status: 'done', imageUrl: url } });
      dispatch({ type: 'ui/toast', toast: { kind: 'success', message: 'Background ready.' } });
    } catch (err: any) {
      commit({ ...project, background: { ...layer, status: 'error', error: err?.message ?? 'failed' } });
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: err?.message ?? 'Background failed.' } });
    }
  }

  function sculptureBasePrompt(extra = ''): string {
    const mat = findMaterial(project.material);
    const materialPhrase = mat?.promptFragment ?? project.material;
    const subject = project.sculptureSubject.trim() || 'a heroic figure';
    const bg = project.backgroundPrompt.trim() ? ` Set in: ${project.backgroundPrompt.trim()}.` : '';
    return `A complete sculpture of ${subject}, made of ${materialPhrase}. Single hero subject, centered, dramatic studio lighting, sharp focus, marketing-grade quality.${bg}${extra ? ' ' + extra : ''}`;
  }

  async function generateBaseSculpture() {
    if (!project.sculptureSubject.trim()) {
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: 'Describe the sculpture subject first.' } });
      return;
    }
    if (!apiKeys.image?.key) {
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: 'Add an Image API key in Settings.' } });
      dispatch({ type: 'ui/openSettings', open: true });
      return;
    }
    const model = state.brief.imageModel;
    const prompt = sculptureBasePrompt();
    const layer: GameLayer = {
      id: uid('layer'),
      kind: 'sculpture',
      index: 0,
      prompt,
      imageModel: model,
      status: 'generating',
      createdAt: Date.now(),
    };
    commit({ ...project, sculptureLayers: [layer] });
    setActiveLayerIdx(0);
    try {
      const { url } = await generateImage({
        apiKeys,
        model,
        prompt,
        aspectRatio: project.aspectRatio,
      });
      commit({ ...project, sculptureLayers: [{ ...layer, status: 'done', imageUrl: url }] });
      dispatch({ type: 'ui/toast', toast: { kind: 'success', message: 'Base sculpture ready — paint cuts to add states.' } });
    } catch (err: any) {
      commit({ ...project, sculptureLayers: [{ ...layer, status: 'error', error: err?.message ?? 'failed' }] });
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: err?.message ?? 'Base sculpture failed.' } });
    }
  }

  function removeLayer(idx: number) {
    const next = project.sculptureLayers.filter((_, i) => i !== idx).map((l, i) => ({ ...l, index: i }));
    commit({ ...project, sculptureLayers: next });
    setActiveLayerIdx(next.length ? Math.min(idx, next.length - 1) : -1);
  }

  async function exportZip() {
    try {
      const { blob, filename } = await exportGameProjectZip(project);
      const a = document.createElement('a');
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      dispatch({ type: 'ui/toast', toast: { kind: 'success', message: `Exported ${filename}.` } });
    } catch (err: any) {
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: err?.message ?? 'Export failed.' } });
    }
  }

  const baseSculpture = project.sculptureLayers[0];
  const activeLayer = activeLayerIdx >= 0 ? project.sculptureLayers[activeLayerIdx] : null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-ink-800 px-3 py-2 sm:px-5 sm:py-3">
        <div className="flex min-w-0 items-center gap-2">
          <button onClick={onBack} className="rounded-md p-1 text-ink-300 hover:bg-ink-800 hover:text-white" title="Back to projects">
            <X size={16} />
          </button>
          <div className="min-w-0">
            <input
              value={project.name}
              onChange={(e) => update({ name: e.target.value })}
              className="w-full truncate bg-transparent font-display text-sm font-semibold uppercase tracking-wider text-ink-100 outline-none"
            />
            <div className="text-[10px] text-ink-400">Auto-saved · {project.sculptureLayers.length} state{project.sculptureLayers.length === 1 ? '' : 's'}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" variant="secondary" onClick={exportZip} disabled={!baseSculpture?.imageUrl}>
            <Download size={14} /> Export ZIP
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
        <Card>
          <SectionHeader title="Setup" subtitle="Material, subject, and target aspect ratio for the whole project." />
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Aspect ratio">
              <Select<AspectRatio>
                value={project.aspectRatio}
                onChange={(v) => update({ aspectRatio: v })}
                options={ASPECT_RATIOS.map((r) => ({ value: r.id, label: `${r.label} — ${r.use.split(' — ')[0]}` }))}
              />
            </Field>
            <Field label="Sculpture material">
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                {SCULPTURE_MATERIALS.map((m) => {
                  const active = project.material === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => update({ material: m.id })}
                      className={cls(
                        'flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-[11px] transition active:scale-95',
                        active ? 'border-brand-400 bg-brand-500/10 text-white' : 'border-ink-700 text-ink-200 hover:border-ink-500'
                      )}
                      title={m.promptFragment}
                    >
                      <span className="inline-block h-3 w-3 shrink-0 rounded-full border border-black/30" style={{ background: m.swatch }} />
                      <span className="truncate">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
          <div className="mt-3 grid gap-3">
            <Field label="Sculpture subject">
              <TextInput
                value={project.sculptureSubject}
                onChange={(v) => update({ sculptureSubject: v })}
                placeholder='e.g. "a king on a throne holding a sword"'
              />
            </Field>
          </div>
        </Card>

        <Card>
          <SectionHeader title="Background" subtitle="One image used as the scene behind the sculpture." />
          <Field label="Background prompt">
            <Textarea
              value={project.backgroundPrompt}
              onChange={(v) => update({ backgroundPrompt: v })}
              rows={2}
              placeholder='e.g. "ornate marble gallery, soft museum lighting, polished floor"'
            />
          </Field>
          <div className="mt-3 flex items-start gap-3">
            <div className="h-28 w-28 shrink-0 overflow-hidden rounded-md border border-ink-700 bg-ink-900">
              {project.background?.imageUrl ? (
                <img src={project.background.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : project.background?.status === 'generating' ? (
                <div className="flex h-full w-full items-center justify-center"><Spinner size={18} className="text-brand-300" /></div>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-ink-500"><FileImage size={20} /></div>
              )}
            </div>
            <div className="flex-1">
              <Button
                size="sm"
                onClick={generateBackground}
                disabled={project.background?.status === 'generating'}
              >
                {project.background?.status === 'generating' ? <Spinner size={14} /> : <Sparkles size={14} />}
                {project.background?.imageUrl ? 'Regenerate background' : 'Generate background'}
              </Button>
              {project.background?.status === 'error' && (
                <p className="mt-2 text-[11px] text-rose-200">{project.background.error}</p>
              )}
              <p className="mt-2 text-[10px] text-ink-500">
                Uses your Image provider + the model from the Brief tab's "Models & count" section.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <SectionHeader
            title="Sculpture layers"
            subtitle="Each layer is a state of the sculpture — players cycle through them as they cut."
            action={baseSculpture?.imageUrl ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setCutOpen(true)}
                disabled={!canInpaint}
                title={!canInpaint ? 'Switch your Image provider to fal.ai to add cut layers.' : 'Add a cut to the current state'}
              >
                <Plus size={14} /> Add cut layer
              </Button>
            ) : null}
          />
          {!baseSculpture ? (
            <div className="rounded-md border border-dashed border-ink-700 p-4 text-center">
              <p className="text-xs text-ink-400">Generate the base sculpture (layer 1) first.</p>
              <Button size="sm" className="mt-2" onClick={generateBaseSculpture} disabled={baseSculpture && (baseSculpture as GameLayer).status === 'generating'}>
                <Sparkles size={14} /> Generate base sculpture
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
              <div className="space-y-2">
                {project.sculptureLayers.map((layer, idx) => (
                  <button
                    key={layer.id}
                    onClick={() => setActiveLayerIdx(idx)}
                    className={cls(
                      'flex w-full items-center gap-2 rounded-md border p-2 text-left transition',
                      activeLayerIdx === idx ? 'border-brand-400 bg-brand-500/10' : 'border-ink-700 hover:border-ink-500'
                    )}
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded border border-ink-700 bg-ink-900">
                      {layer.imageUrl ? (
                        <img src={layer.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : layer.status === 'generating' ? (
                        <div className="flex h-full w-full items-center justify-center"><Spinner size={12} className="text-brand-300" /></div>
                      ) : layer.status === 'error' ? (
                        <div className="flex h-full w-full items-center justify-center text-[9px] text-rose-200">err</div>
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-white">State {idx + 1}{idx === 0 ? ' · full' : ''}</div>
                      <div className="truncate text-[10px] text-ink-400">{layer.cutNote || (idx === 0 ? 'Base sculpture' : 'cut')}</div>
                    </div>
                    {idx > 0 && (
                      <span
                        role="button"
                        onClick={(e) => { e.stopPropagation(); removeLayer(idx); }}
                        className="rounded p-1 text-ink-400 hover:bg-ink-700 hover:text-rose-300"
                        title="Remove this layer"
                      >
                        <Trash2 size={12} />
                      </span>
                    )}
                  </button>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={generateBaseSculpture}
                  disabled={baseSculpture.status === 'generating'}
                  className="w-full"
                  title="Regenerate the base sculpture (deletes all cut states)"
                >
                  <Sparkles size={14} /> Regenerate base
                </Button>
              </div>
              <div className="overflow-hidden rounded-md border border-ink-700 bg-ink-900">
                {activeLayer?.imageUrl ? (
                  <img src={activeLayer.imageUrl} alt="" className="h-full max-h-[420px] w-full object-contain" />
                ) : activeLayer?.status === 'generating' ? (
                  <div className="flex aspect-square items-center justify-center"><Spinner size={20} className="text-brand-300" /></div>
                ) : (
                  <div className="flex aspect-square items-center justify-center text-xs text-ink-400">No preview</div>
                )}
              </div>
            </div>
          )}
          {!canInpaint && baseSculpture?.imageUrl && (
            <p className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
              Cut layers use fal.ai's FLUX Pro Fill inpainting. Switch your Image provider to fal.ai in Settings to enable "Add cut layer".
            </p>
          )}
        </Card>
      </div>

      <AnimatePresence>
        {cutOpen && activeLayer?.imageUrl && (
          <CutLayerModal
            sourceImageUrl={activeLayer.imageUrl}
            material={project.material}
            onClose={() => setCutOpen(false)}
            onApply={async (maskDataUrl, cutNote) => {
              setCutOpen(false);
              const newIdx = project.sculptureLayers.length;
              const mat = findMaterial(project.material);
              const prompt = `Same ${mat?.promptFragment ?? project.material} sculpture, but with the painted region broken off — clean break, exposed sculpture interior, missing piece, do not add anything new in its place. Keep the rest of the sculpture and scene identical.${cutNote ? ' ' + cutNote : ''}`;
              const layer: GameLayer = {
                id: uid('layer'),
                kind: 'sculpture',
                index: newIdx,
                prompt,
                cutNote,
                imageModel: 'fal-ai/flux-pro/v1/fill',
                status: 'generating',
                createdAt: Date.now(),
              };
              commit({ ...project, sculptureLayers: [...project.sculptureLayers, layer] });
              setActiveLayerIdx(newIdx);
              try {
                // Load the source as a data URL so the inpaint cache key is stable.
                const sourceDataUrl = await urlToDataUrl(activeLayer.imageUrl!);
                const { url } = await generateImageInpaint({
                  apiKeys,
                  sourceImageDataUrl: sourceDataUrl,
                  maskDataUrl,
                  prompt,
                  aspectRatio: project.aspectRatio,
                });
                // Reflect against latest project state in case of intervening edits.
                setProject((cur) => {
                  const next = {
                    ...cur,
                    sculptureLayers: cur.sculptureLayers.map((l) => l.id === layer.id ? { ...l, status: 'done' as const, imageUrl: url } : l),
                    updatedAt: Date.now(),
                  };
                  dispatch({ type: 'gameProjects/upsert', project: next });
                  putGameProject(next).catch(() => {});
                  return next;
                });
                dispatch({ type: 'ui/toast', toast: { kind: 'success', message: `Cut state ${newIdx + 1} ready.` } });
              } catch (err: any) {
                setProject((cur) => {
                  const next = {
                    ...cur,
                    sculptureLayers: cur.sculptureLayers.map((l) => l.id === layer.id ? { ...l, status: 'error' as const, error: err?.message ?? 'failed' } : l),
                    updatedAt: Date.now(),
                  };
                  dispatch({ type: 'gameProjects/upsert', project: next });
                  putGameProject(next).catch(() => {});
                  return next;
                });
                dispatch({ type: 'ui/toast', toast: { kind: 'error', message: err?.message ?? 'Cut failed.' } });
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

async function urlToDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

// --- Cut layer modal -------------------------------------------------------

function CutLayerModal({
  sourceImageUrl, material, onClose, onApply,
}: {
  sourceImageUrl: string;
  material: string;
  onClose: () => void;
  onApply: (maskDataUrl: string, cutNote: string) => Promise<void>;
}) {
  const maskRef = useRef<MaskCanvasHandle>(null);
  const [cutNote, setCutNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function apply() {
    if (!maskRef.current?.hasContent()) return;
    setBusy(true);
    try {
      const mask = maskRef.current!.getMaskDataUrl()!;
      await onApply(mask, cutNote.trim());
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/85 px-2 py-4 backdrop-blur-sm sm:px-4 sm:py-10" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="relative w-full max-w-5xl rounded-2xl border border-ink-700 bg-ink-900 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-ink-700 px-5 py-3">
          <h2 className="flex items-center gap-2 truncate font-display text-lg font-semibold text-white">
            <Box size={18} className="text-brand-300" /> Add cut layer
          </h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-ink-300 hover:bg-ink-800 hover:text-white" title="Close">
            <X size={18} />
          </button>
        </div>
        <div className="grid gap-4 p-5 lg:grid-cols-[1.6fr_1fr]">
          <MaskCanvas ref={maskRef} imageUrl={sourceImageUrl} />
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-200">Paint over the piece to cut</div>
              <p className="text-[11px] text-ink-400">
                Painted area becomes a clean break in the {findMaterial(material)?.label ?? material}. The rest of the
                sculpture and the background stay the same.
              </p>
            </div>
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-200">Cut description (optional)</div>
              <TextInput
                value={cutNote}
                onChange={setCutNote}
                placeholder='e.g. "right arm removed" / "missing crown"'
              />
              <p className="mt-1 text-[10px] text-ink-400">
                Shown on the layer chip and stored in the project manifest. Doesn't have to be long.
              </p>
            </div>
            <div className="rounded-md border border-ink-700 bg-ink-850 p-3 text-[11px] text-ink-300">
              <div className="mb-1 font-semibold text-ink-100">Tip</div>
              Each cut layer is generated from the <em>currently selected</em> state, so you can chain edits — cut the
              arm, then cut the head, then cut the torso.
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button size="sm" onClick={apply} disabled={busy}>
                {busy ? <Spinner size={14} /> : <Save size={14} />}
                {busy ? 'Cutting…' : 'Apply cut'}
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

