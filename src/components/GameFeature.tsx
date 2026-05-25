import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Box, Download, FileImage, Image as ImageIcon, Layers, Plus, Save, Sparkles, Trash2, X,
} from 'lucide-react';
import { useStore } from '../state/store';
import { ASPECT_RATIOS } from '../lib/models';
import { SCULPTURE_MATERIALS, findMaterial } from '../lib/materials';
import { generateImage, generateImageInpaint, removeBackground } from '../lib/api';
import { deleteGameProject, putGameProject } from '../lib/storage';
import { exportGameProjectZip } from '../lib/projectExport';
import { cls, compositeOnSolid, uid } from '../lib/utils';
import type { AspectRatio, GameLayer, GameProject, LayerTransform } from '../types';
import { Button, Card, Field, SectionHeader, Select, Spinner, TextInput, Textarea } from './ui';
import { MaskCanvas, type MaskCanvasHandle } from './MaskCanvas';
import { COMPOSITE_DEFAULTS, CompositeCanvas } from './CompositeCanvas';

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

function aspectRatioWH(id: AspectRatio): number {
  const ar = ASPECT_RATIOS.find((a) => a.id === id) ?? ASPECT_RATIOS[0];
  return ar.w / ar.h;
}

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
          <div className="truncate text-xs text-ink-400">Layered sculpture projects: background + draggable transparent sculpture + cut states.</div>
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
                Each project gives you a background image + a transparent sculpture you can drag and resize
                over it. Add cut layers to create a sequence the game cycles through as players cut pieces away.
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
  const onFal = imageProvider === 'fal';

  function commit(next: GameProject) {
    const updated = { ...next, updatedAt: Date.now() };
    setProject(updated);
    dispatch({ type: 'gameProjects/upsert', project: updated });
    putGameProject(updated).catch(() => {});
  }

  function update<K extends keyof GameProject>(patch: Pick<GameProject, K>) {
    commit({ ...project, ...patch });
  }

  function setLayerTransform(idx: number, t: LayerTransform) {
    if (idx < 0) return;
    const next = project.sculptureLayers.map((l, i) => (i === idx ? { ...l, transform: t } : l));
    commit({ ...project, sculptureLayers: next });
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
      setProject((cur) => {
        const next = { ...cur, background: { ...layer, status: 'done' as const, imageUrl: url }, updatedAt: Date.now() };
        dispatch({ type: 'gameProjects/upsert', project: next });
        putGameProject(next).catch(() => {});
        return next;
      });
      dispatch({ type: 'ui/toast', toast: { kind: 'success', message: 'Background ready.' } });
    } catch (err: any) {
      setProject((cur) => {
        const next = { ...cur, background: { ...layer, status: 'error' as const, error: err?.message ?? 'failed' }, updatedAt: Date.now() };
        dispatch({ type: 'gameProjects/upsert', project: next });
        putGameProject(next).catch(() => {});
        return next;
      });
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: err?.message ?? 'Background failed.' } });
    }
  }

  function sculptureBasePrompt(): string {
    const mat = findMaterial(project.material);
    const materialPhrase = mat?.promptFragment ?? project.material;
    const subject = project.sculptureSubject.trim() || 'a heroic figure';
    return `A complete sculpture of ${subject}, made of ${materialPhrase}. Isolated on a plain solid white seamless backdrop, no scenery, no props, no shadows on the floor. Single hero subject, centered, full body visible, dramatic studio lighting, sharp focus, marketing-grade quality.`;
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
    if (!onFal) {
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: 'Sculpture generation needs fal.ai as the Image provider so we can cut a transparent background.' } });
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
      transform: { ...COMPOSITE_DEFAULTS },
    };
    commit({ ...project, sculptureLayers: [layer] });
    setActiveLayerIdx(0);
    try {
      const { url: opaqueUrl } = await generateImage({
        apiKeys,
        model,
        prompt,
        aspectRatio: project.aspectRatio,
      });
      dispatch({ type: 'ui/toast', toast: { kind: 'info', message: 'Cutting out the background…' } });
      const { url: transparentUrl } = await removeBackground({ apiKeys, imageDataUrl: opaqueUrl });
      setProject((cur) => {
        const next = {
          ...cur,
          sculptureLayers: [{
            ...layer,
            status: 'done' as const,
            imageUrl: transparentUrl,
            isTransparent: true,
          }],
          updatedAt: Date.now(),
        };
        dispatch({ type: 'gameProjects/upsert', project: next });
        putGameProject(next).catch(() => {});
        return next;
      });
      dispatch({ type: 'ui/toast', toast: { kind: 'success', message: 'Sculpture ready — drag it on the canvas to position.' } });
    } catch (err: any) {
      setProject((cur) => {
        const next = {
          ...cur,
          sculptureLayers: [{ ...layer, status: 'error' as const, error: err?.message ?? 'failed' }],
          updatedAt: Date.now(),
        };
        dispatch({ type: 'gameProjects/upsert', project: next });
        putGameProject(next).catch(() => {});
        return next;
      });
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: err?.message ?? 'Sculpture generation failed.' } });
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
  const activeTransform = activeLayer?.transform ?? COMPOSITE_DEFAULTS;

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
        {!onFal && (
          <Card className="border-amber-500/50 bg-amber-500/10">
            <div className="flex items-start gap-2 text-[12px] text-amber-100">
              <Sparkles size={14} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold">Game Feature needs fal.ai as the Image provider.</div>
                <p className="mt-0.5 text-[11px] text-amber-200/90">
                  We use fal.ai's background-removal endpoint to cut the sculpture into a transparent PNG, and
                  FLUX Pro Fill to generate cut layers. Open Settings to switch.
                </p>
                <button
                  className="mt-1 inline-flex items-center gap-1 rounded-md border border-amber-400/60 px-2 py-1 text-[11px] text-amber-100 hover:bg-amber-500/20"
                  onClick={() => dispatch({ type: 'ui/openSettings', open: true })}
                >
                  Open Settings →
                </button>
              </div>
            </div>
          </Card>
        )}

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
            title="Compose & cut"
            subtitle="Drag the sculpture to position it; scroll or use the slider to scale. Add cuts to create more states."
            action={baseSculpture?.imageUrl ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setCutOpen(true)}
                disabled={!onFal || (activeLayer?.status !== 'done')}
                title={!onFal ? 'Switch your Image provider to fal.ai to add cut layers.' : 'Add a cut to the currently selected state'}
              >
                <Plus size={14} /> Add cut layer
              </Button>
            ) : null}
          />

          {!baseSculpture ? (
            <div className="rounded-md border border-dashed border-ink-700 p-4 text-center">
              <p className="text-xs text-ink-400">Generate the sculpture (state 1) to start composing.</p>
              <Button size="sm" className="mt-2" onClick={generateBaseSculpture} disabled={!onFal || baseSculpture && (baseSculpture as GameLayer).status === 'generating'}>
                <Sparkles size={14} /> Generate sculpture
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-[230px_minmax(0,1fr)]">
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
                    <div
                      className="h-12 w-12 shrink-0 overflow-hidden rounded border border-ink-700"
                      style={{
                        backgroundImage: 'linear-gradient(45deg, #2a2a35 25%, transparent 25%), linear-gradient(-45deg, #2a2a35 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2a2a35 75%), linear-gradient(-45deg, transparent 75%, #2a2a35 75%)',
                        backgroundSize: '10px 10px',
                        backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px',
                      }}
                    >
                      {layer.imageUrl ? (
                        <img src={layer.imageUrl} alt="" className="h-full w-full object-contain" />
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
                  disabled={!onFal || baseSculpture.status === 'generating'}
                  className="w-full"
                  title="Regenerate the base sculpture (replaces all cut states)"
                >
                  <Sparkles size={14} /> Regenerate sculpture
                </Button>
              </div>

              <CompositeCanvas
                backgroundUrl={project.background?.imageUrl}
                sculptureUrl={activeLayer?.imageUrl}
                transform={activeTransform}
                onTransformChange={(t) => setLayerTransform(activeLayerIdx, t)}
                aspectRatio={aspectRatioWH(project.aspectRatio)}
                locked={activeLayer?.status !== 'done'}
              />
            </div>
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
              const prompt = `Same ${mat?.promptFragment ?? project.material} sculpture isolated on plain white backdrop, but with the painted region broken off — clean break, exposed sculpture interior, missing piece, do not add anything new in its place. Keep the rest of the sculpture identical. ${cutNote ? ' ' + cutNote : ''}`;
              const layer: GameLayer = {
                id: uid('layer'),
                kind: 'sculpture',
                index: newIdx,
                prompt,
                cutNote,
                imageModel: 'fal-ai/flux-pro/v1/fill',
                status: 'generating',
                createdAt: Date.now(),
                transform: { ...activeTransform },
              };
              commit({ ...project, sculptureLayers: [...project.sculptureLayers, layer] });
              setActiveLayerIdx(newIdx);
              try {
                // The active layer is transparent; FLUX Fill expects an opaque source, so flatten it
                // onto white first. The mask was painted against this same composite (the modal also
                // composites on white), so coordinates align.
                const sourceOnWhite = await compositeOnSolid(activeLayer.imageUrl!, '#ffffff');
                const { url: editedOpaqueUrl } = await generateImageInpaint({
                  apiKeys,
                  sourceImageDataUrl: sourceOnWhite,
                  maskDataUrl,
                  prompt,
                  aspectRatio: project.aspectRatio,
                });
                // Cut the background back out so the new state is also transparent.
                const { url: transparentUrl } = await removeBackground({ apiKeys, imageDataUrl: editedOpaqueUrl });
                setProject((cur) => {
                  const next = {
                    ...cur,
                    sculptureLayers: cur.sculptureLayers.map((l) =>
                      l.id === layer.id ? { ...l, status: 'done' as const, imageUrl: transparentUrl, isTransparent: true } : l,
                    ),
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
                    sculptureLayers: cur.sculptureLayers.map((l) =>
                      l.id === layer.id ? { ...l, status: 'error' as const, error: err?.message ?? 'failed' } : l,
                    ),
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
  const [whiteSrc, setWhiteSrc] = useState<string | null>(null);

  // The source layer is transparent, so we composite it onto white for the painter.
  // The actual inpaint API call (in the parent) flattens with the same colour, so mask
  // coordinates align.
  useEffect(() => {
    let cancelled = false;
    compositeOnSolid(sourceImageUrl, '#ffffff')
      .then((url) => { if (!cancelled) setWhiteSrc(url); })
      .catch(() => { if (!cancelled) setWhiteSrc(sourceImageUrl); });
    return () => { cancelled = true; };
  }, [sourceImageUrl]);

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
          {whiteSrc ? (
            <MaskCanvas ref={maskRef} imageUrl={whiteSrc} />
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-lg border border-ink-700 bg-ink-900">
              <Spinner size={20} className="text-brand-300" />
            </div>
          )}
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-200">Paint over the piece to cut</div>
              <p className="text-[11px] text-ink-400">
                The painted area becomes a clean break in the {findMaterial(material)?.label ?? material}. The new
                state stays a transparent PNG.
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
                Shown on the layer chip and stored in the project manifest.
              </p>
            </div>
            <div className="rounded-md border border-ink-700 bg-ink-850 p-3 text-[11px] text-ink-300">
              <div className="mb-1 font-semibold text-ink-100">How it works</div>
              <ol className="list-decimal space-y-0.5 pl-4">
                <li>Inpaint the painted region of the sculpture (FLUX Pro Fill).</li>
                <li>Cut the background out again (rembg).</li>
                <li>Save as a new transparent PNG state.</li>
              </ol>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button size="sm" onClick={apply} disabled={busy || !whiteSrc}>
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
