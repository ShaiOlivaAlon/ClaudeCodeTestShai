import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckSquare, Download, Film, FolderOpen, Image as ImageIcon, Layers, Plus, Play,
  RefreshCw, Sparkles, Square, Trash2, Upload, X,
} from 'lucide-react';
import { useStore } from '../state/store';
import { IMAGE_MODELS, VIDEO_MODELS } from '../lib/models';
import {
  reskinAsset, generateVideo, makeAnimatePrompt,
} from '../lib/api';
import { deleteReskinProject, putReskinProject } from '../lib/storage';
import { exportReskinProjectZip } from '../lib/reskinExport';
import { cls, fileToDataUrl, imageDimensions, uid } from '../lib/utils';
import type { GenerationStatus, ReskinAsset, ReskinLora, ReskinProject } from '../types';
import { Button, Card, Field, SectionHeader, Select, Spinner, TextInput, Textarea } from './ui';

const CONCURRENCY = 3;

function emptyProject(defaultImageModel: string, defaultVideoModel: string): ReskinProject {
  const now = Date.now();
  return {
    id: uid('reskin'),
    name: 'Untitled reskin',
    createdAt: now,
    updatedAt: now,
    prompt: '',
    strength: 0.75,
    imageModel: defaultImageModel,
    styleReferenceAssetIds: [],
    loras: [],
    assets: [],
    videoModel: defaultVideoModel,
  };
}

export function ReskinFeature() {
  const { state, dispatch } = useStore();
  const active = state.reskinProjects.find((p) => p.id === state.activeReskinProjectId);

  function newProject() {
    // Default to a fal img-to-img model since reskin requires fal.
    const falImgToImg = IMAGE_MODELS.find((m) => m.id === 'fal-ai/flux-lora/image-to-image')
      ?? IMAGE_MODELS.find((m) => m.id === 'fal-ai/flux/dev/image-to-image');
    const defaultImg = falImgToImg?.id ?? state.brief.imageModel;
    const p = emptyProject(defaultImg, state.brief.videoModel);
    dispatch({ type: 'reskinProjects/upsert', project: p });
    dispatch({ type: 'reskinProjects/setActive', id: p.id });
    putReskinProject(p).catch(() => {});
  }

  if (active) {
    return <ProjectEditor key={active.id} project={active} onBack={() => dispatch({ type: 'reskinProjects/setActive', id: null })} />;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-ink-800 px-3 py-2 sm:px-5 sm:py-3">
        <div className="min-w-0">
          <div className="font-display text-sm font-semibold uppercase tracking-wider text-ink-100">Reskin</div>
          <div className="truncate text-xs text-ink-400">Bulk image-to-image: upload a folder, type a new theme, regenerate at original sizes.</div>
        </div>
        <Button size="sm" onClick={newProject}><Plus size={14} /> New project</Button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
        {state.reskinProjects.length === 0 ? (
          <Card className="border-dashed">
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <Layers size={28} className="text-brand-300" />
              <div className="text-sm font-medium text-white">No reskin projects yet</div>
              <p className="max-w-md text-xs text-ink-400">
                Drop a folder of game assets in, write a new theme prompt (optionally with style references and
                LoRAs), and the studio regenerates each asset at its original dimensions. Animate the ones you like
                straight after.
              </p>
              <Button size="sm" onClick={newProject}><Plus size={14} /> New project</Button>
            </div>
          </Card>
        ) : (
          state.reskinProjects.map((p) => <ProjectRow key={p.id} project={p} />)
        )}
      </div>
    </div>
  );
}

function ProjectRow({ project }: { project: ReskinProject }) {
  const { dispatch } = useStore();
  const done = project.assets.filter((a) => a.status === 'done').length;
  const thumb = project.assets.find((a) => a.resultUrl)?.resultUrl ?? project.assets[0]?.sourceDataUrl;
  async function remove(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete reskin project "${project.name}"?`)) return;
    await deleteReskinProject(project.id);
    dispatch({ type: 'reskinProjects/remove', id: project.id });
  }
  return (
    <button
      onClick={() => dispatch({ type: 'reskinProjects/setActive', id: project.id })}
      className="group flex w-full items-center gap-3 rounded-lg border border-ink-700 bg-ink-850 p-3 text-left transition hover:border-brand-400/60 hover:bg-ink-800"
    >
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-ink-700 bg-ink-900">
        {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-ink-500"><ImageIcon size={18} /></div>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-white">{project.name}</div>
        <div className="truncate text-[11px] text-ink-400">
          {project.assets.length} asset{project.assets.length === 1 ? '' : 's'} · {done} reskinned · {project.loras.length} LoRA{project.loras.length === 1 ? '' : 's'}
        </div>
      </div>
      <button onClick={remove} className="opacity-0 transition group-hover:opacity-100" title="Delete project">
        <Trash2 size={14} className="text-rose-300 hover:text-rose-200" />
      </button>
    </button>
  );
}

// --- Project editor --------------------------------------------------------

type SubTab = 'compose' | 'animate';

function ProjectEditor({ project: initial, onBack }: { project: ReskinProject; onBack: () => void }) {
  const { state, dispatch } = useStore();
  const [project, setProject] = useState<ReskinProject>(initial);
  const [tab, setTab] = useState<SubTab>('compose');
  const projectRef = useRef(project);
  projectRef.current = project;

  const apiKeys = state.settings.apiKeys;
  const onFal = apiKeys.image?.provider === 'fal';

  function commit(next: ReskinProject | ((cur: ReskinProject) => ReskinProject)) {
    setProject((cur) => {
      const updated = typeof next === 'function' ? (next as (cur: ReskinProject) => ReskinProject)(cur) : next;
      const stamped = { ...updated, updatedAt: Date.now() };
      dispatch({ type: 'reskinProjects/upsert', project: stamped });
      putReskinProject(stamped).catch(() => {});
      return stamped;
    });
  }

  function update(patch: Partial<ReskinProject>) {
    commit((cur) => ({ ...cur, ...patch }));
  }

  async function ingestFiles(files: File[]) {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (!images.length) {
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: 'No image files found in that selection.' } });
      return;
    }
    const newAssets: ReskinAsset[] = [];
    for (const f of images) {
      try {
        const data = await fileToDataUrl(f);
        const { width, height } = await imageDimensions(data);
        newAssets.push({
          id: uid('rasset'),
          fileName: f.name,
          width: width || 0,
          height: height || 0,
          sourceDataUrl: data,
          status: 'idle',
          selected: true,
        });
      } catch (err) {
        console.error('ingest failed', f.name, err);
      }
    }
    if (newAssets.length) {
      commit((cur) => ({ ...cur, assets: [...cur.assets, ...newAssets] }));
      dispatch({ type: 'ui/toast', toast: { kind: 'success', message: `Added ${newAssets.length} asset${newAssets.length === 1 ? '' : 's'}.` } });
    }
  }

  function removeAsset(id: string) {
    commit((cur) => ({ ...cur, assets: cur.assets.filter((a) => a.id !== id) }));
  }

  function toggleAsset(id: string) {
    commit((cur) => ({ ...cur, assets: cur.assets.map((a) => a.id === id ? { ...a, selected: !a.selected } : a) }));
  }

  function patchAsset(id: string, patch: Partial<ReskinAsset>) {
    commit((cur) => ({ ...cur, assets: cur.assets.map((a) => a.id === id ? { ...a, ...patch } : a) }));
  }

  // --- Reskin batch --------------------------------------------------------

  const [running, setRunning] = useState(false);

  async function reskinOne(asset: ReskinAsset) {
    patchAsset(asset.id, { status: 'generating', error: undefined });
    try {
      const { url } = await reskinAsset({
        apiKeys,
        model: project.imageModel,
        prompt: project.prompt,
        sourceDataUrl: asset.sourceDataUrl,
        width: asset.width || 1024,
        height: asset.height || 1024,
        strength: project.strength,
        loras: project.loras.map((l) => ({
          kind: l.kind,
          fileDataUrl: l.fileDataUrl,
          huggingfaceId: l.huggingfaceId,
          scale: l.scale,
        })),
      });
      patchAsset(asset.id, { status: 'done', resultUrl: url });
    } catch (err: any) {
      patchAsset(asset.id, { status: 'error', error: err?.message ?? 'failed' });
    }
  }

  async function runBatch(scope: 'all' | 'selected' | 'idle') {
    if (!apiKeys.image?.key) {
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: 'Add an Image API key in Settings first.' } });
      dispatch({ type: 'ui/openSettings', open: true });
      return;
    }
    if (!onFal) {
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: 'Reskin currently requires fal.ai as the Image provider.' } });
      dispatch({ type: 'ui/openSettings', open: true });
      return;
    }
    if (!project.prompt.trim()) {
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: 'Write a reskin prompt before generating.' } });
      return;
    }
    const targets = projectRef.current.assets.filter((a) => {
      if (scope === 'selected') return a.selected;
      if (scope === 'idle')     return a.status === 'idle' || a.status === 'error';
      return true;
    });
    if (!targets.length) {
      dispatch({ type: 'ui/toast', toast: { kind: 'info', message: 'Nothing to reskin in that scope.' } });
      return;
    }
    setRunning(true);
    dispatch({ type: 'ui/toast', toast: { kind: 'info', message: `Reskinning ${targets.length} asset${targets.length === 1 ? '' : 's'} (${CONCURRENCY} in parallel)…` } });
    // Mini work-stealing queue with N parallel workers.
    const queue = targets.map((t) => t.id);
    queue.forEach((id) => patchAsset(id, { status: 'queued', error: undefined }));
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length) {
        const id = queue.shift()!;
        const a = projectRef.current.assets.find((x) => x.id === id);
        if (!a) continue;
        await reskinOne(a);
      }
    });
    try {
      await Promise.all(workers);
      const failed = projectRef.current.assets.filter((a) => a.status === 'error').length;
      const done = projectRef.current.assets.filter((a) => a.status === 'done').length;
      dispatch({ type: 'ui/toast', toast: { kind: failed ? 'error' : 'success', message: failed ? `${done} done, ${failed} failed — check each card for the error.` : `Reskinned ${done} asset${done === 1 ? '' : 's'}.` } });
    } finally {
      setRunning(false);
    }
  }

  // --- LoRA management ----------------------------------------------------

  async function addLoraFile(file: File) {
    try {
      const dataUrl = await fileToDataUrl(file);
      const lora: ReskinLora = {
        id: uid('lora'),
        kind: 'file',
        fileName: file.name,
        fileDataUrl: dataUrl,
        scale: 1,
      };
      commit((cur) => ({ ...cur, loras: [...cur.loras, lora] }));
    } catch (err) {
      console.error(err);
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: `Failed to read ${file.name}` } });
    }
  }
  function addLoraHf(id: string) {
    const trimmed = id.trim();
    if (!trimmed) return;
    const lora: ReskinLora = {
      id: uid('lora'),
      kind: 'huggingface',
      huggingfaceId: trimmed,
      scale: 1,
    };
    commit((cur) => ({ ...cur, loras: [...cur.loras, lora] }));
  }
  function updateLora(id: string, patch: Partial<ReskinLora>) {
    commit((cur) => ({ ...cur, loras: cur.loras.map((l) => l.id === id ? { ...l, ...patch } : l) }));
  }
  function removeLora(id: string) {
    commit((cur) => ({ ...cur, loras: cur.loras.filter((l) => l.id !== id) }));
  }

  // --- Export ZIP ---------------------------------------------------------

  async function exportZip(onlySelected: boolean) {
    try {
      const { blob, filename } = await exportReskinProjectZip(projectRef.current, onlySelected);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
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

  // --- Animate ------------------------------------------------------------

  async function animateOne(asset: ReskinAsset) {
    if (!asset.resultUrl) return;
    if (!apiKeys.video?.key) {
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: 'Add a Video API key in Settings to animate.' } });
      dispatch({ type: 'ui/openSettings', open: true });
      return;
    }
    patchAsset(asset.id, { videoStatus: 'generating' as GenerationStatus, videoError: undefined });
    try {
      const ratio: '1:1' | '16:9' | '9:16' = asset.width > asset.height * 1.1
        ? '16:9' : (asset.height > asset.width * 1.1 ? '9:16' : '1:1');
      const animPrompt = makeAnimatePrompt({
        title: asset.fileName,
        description: project.prompt,
        prompt: project.prompt,
      });
      const { url } = await generateVideo({
        apiKeys,
        model: project.videoModel ?? state.brief.videoModel,
        prompt: animPrompt,
        imageUrl: asset.resultUrl,
        aspectRatio: ratio,
      });
      patchAsset(asset.id, { videoStatus: 'done', videoUrl: url });
    } catch (err: any) {
      patchAsset(asset.id, { videoStatus: 'error', videoError: err?.message ?? 'failed' });
    }
  }

  async function animateBatch() {
    const targets = projectRef.current.assets.filter((a) => a.selected && a.resultUrl && a.videoStatus !== 'done');
    if (!targets.length) {
      dispatch({ type: 'ui/toast', toast: { kind: 'info', message: 'Tick reskinned assets first, then click Animate selected.' } });
      return;
    }
    dispatch({ type: 'ui/toast', toast: { kind: 'info', message: `Animating ${targets.length} clip${targets.length === 1 ? '' : 's'} — video can take a few minutes each.` } });
    const queue = targets.map((t) => t.id);
    const workers = Array.from({ length: Math.min(2, queue.length) }, async () => {
      while (queue.length) {
        const id = queue.shift()!;
        const a = projectRef.current.assets.find((x) => x.id === id);
        if (a) await animateOne(a);
      }
    });
    await Promise.all(workers);
  }

  // --- Image / video model lists -----------------------------------------

  const imageModelOptions = IMAGE_MODELS.filter((m) => m.provider === 'fal' && (m.id.includes('image-to-image') || m.id.includes('flux-pulid')));
  const videoModelOptions = VIDEO_MODELS;

  // --- Render -------------------------------------------------------------

  const selectedCount = project.assets.filter((a) => a.selected).length;
  const doneCount = project.assets.filter((a) => a.status === 'done').length;
  const errorCount = project.assets.filter((a) => a.status === 'error').length;

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
            <div className="text-[10px] text-ink-400">
              Auto-saved · {project.assets.length} asset{project.assets.length === 1 ? '' : 's'} · {doneCount} reskinned{errorCount ? ` · ${errorCount} failed` : ''}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => exportZip(false)} disabled={!doneCount}>
            <Download size={14} /> Export ZIP
          </Button>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 border-b border-ink-800 bg-ink-950/40 px-2 py-1.5">
        <ModeTab active={tab === 'compose'} onClick={() => setTab('compose')} label="Reskin" />
        <ModeTab active={tab === 'animate'} onClick={() => setTab('animate')} label={`Animate · ${selectedCount}`} />
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
        {!onFal && (
          <Card className="border-amber-500/50 bg-amber-500/10">
            <div className="flex items-start gap-2 text-[12px] text-amber-100">
              <Sparkles size={14} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold">Reskin needs fal.ai as the Image provider.</div>
                <p className="mt-0.5 text-[11px] text-amber-200/90">
                  We use fal img-to-img endpoints because they preserve each asset's exact dimensions and support
                  LoRAs. Open Settings to switch.
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

        {tab === 'compose' && (
          <>
            <UploadCard onIngest={ingestFiles} />

            <Card>
              <SectionHeader title="Reskin brief" subtitle="Each source asset is regenerated at its original dimensions with this prompt + LoRAs applied." />
              <div className="grid gap-3">
                <Field label="Prompt">
                  <Textarea
                    rows={3}
                    value={project.prompt}
                    onChange={(v) => update({ prompt: v })}
                    placeholder='e.g. "Re-render this as a 70s sci-fi pulp magazine cover, dramatic chiaroscuro lighting, halftone shading, muted palette"'
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Image model (img-to-img)">
                    <Select
                      value={project.imageModel}
                      onChange={(v) => update({ imageModel: v })}
                      options={imageModelOptions.map((m) => ({ value: m.id, label: m.name, hint: m.description }))}
                    />
                  </Field>
                  <Field label={`Img-to-img strength: ${project.strength.toFixed(2)}`}>
                    <input
                      type="range" min={0.1} max={1} step={0.05} value={project.strength}
                      onChange={(e) => update({ strength: Number(e.target.value) })}
                      className="w-full accent-brand-500"
                    />
                    <p className="mt-1 text-[10px] text-ink-400">Lower = closer to source. Higher = closer to the prompt.</p>
                  </Field>
                </div>
                <LoraPanel
                  loras={project.loras}
                  onAddFile={addLoraFile}
                  onAddHf={addLoraHf}
                  onUpdate={updateLora}
                  onRemove={removeLora}
                />
              </div>
            </Card>

            <Card>
              <SectionHeader
                title={`Assets · ${project.assets.length}`}
                subtitle="Click an asset to toggle selection. Use the action bar above to reskin in batches."
                action={
                  <div className="flex flex-wrap gap-2 text-xs">
                    <button onClick={() => commit((cur) => ({ ...cur, assets: cur.assets.map((a) => ({ ...a, selected: true })) }))} className="text-ink-300 hover:text-white">select all</button>
                    <span className="text-ink-600">·</span>
                    <button onClick={() => commit((cur) => ({ ...cur, assets: cur.assets.map((a) => ({ ...a, selected: false })) }))} className="text-ink-300 hover:text-white">none</button>
                  </div>
                }
              />
              {project.assets.length === 0 ? (
                <p className="text-xs text-ink-400">Upload some assets above to start.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {project.assets.map((a) => (
                    <AssetCard key={a.id} asset={a} onToggle={() => toggleAsset(a.id)} onRemove={() => removeAsset(a.id)} onReskin={() => reskinOne(a)} disabled={running} />
                  ))}
                </div>
              )}
            </Card>

            <Card className="border-brand-400/40 bg-brand-500/5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">Reskin batch</div>
                  <div className="text-[11px] text-ink-300">Runs {CONCURRENCY} jobs in parallel. Failures are recoverable per-asset.</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => runBatch('idle')} disabled={running}>
                    <RefreshCw size={14} /> Reskin remaining
                  </Button>
                  <Button size="sm" onClick={() => runBatch('all')} disabled={running}>
                    {running ? <Spinner size={14} /> : <Sparkles size={14} />}
                    {running ? 'Reskinning…' : 'Reskin all'}
                  </Button>
                </div>
              </div>
            </Card>
          </>
        )}

        {tab === 'animate' && (
          <Card>
            <SectionHeader
              title="Animate selected reskins"
              subtitle="Tick the assets you want to animate; we'll batch through them 2 at a time."
              action={
                <div className="flex items-center gap-2">
                  <Select
                    value={project.videoModel ?? state.brief.videoModel}
                    onChange={(v) => update({ videoModel: v })}
                    options={videoModelOptions.map((m) => ({ value: m.id, label: m.name }))}
                    className="!w-48"
                  />
                  <Button size="sm" onClick={animateBatch}>
                    <Film size={14} /> Animate selected
                  </Button>
                </div>
              }
            />
            {project.assets.filter((a) => a.resultUrl).length === 0 ? (
              <p className="text-xs text-ink-400">Reskin some assets first — animation works on the regenerated images.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {project.assets.filter((a) => a.resultUrl).map((a) => (
                  <AnimateCard key={a.id} asset={a} onToggle={() => toggleAsset(a.id)} onAnimate={() => animateOne(a)} />
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function ModeTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cls(
        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition active:scale-95',
        active ? 'bg-brand-500/20 text-white shadow-[inset_0_0_0_1px_rgba(168,117,255,0.4)]' : 'text-ink-400 hover:text-white',
      )}
    >
      {label}
    </button>
  );
}

// --- Upload area -----------------------------------------------------------

function UploadCard({ onIngest }: { onIngest: (files: File[]) => Promise<void> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const dirRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      await onIngest(Array.from(e.target.files));
    }
    e.target.value = '';
  }

  async function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const items = e.dataTransfer.items;
    const out: File[] = [];
    if (items && items.length && typeof (items[0] as any).webkitGetAsEntry === 'function') {
      // Folder-aware drop: walk DataTransferItemList recursively.
      const walks = Array.from(items).map((it) => {
        const entry = (it as any).webkitGetAsEntry?.() as FileSystemEntry | null;
        return entry ? walkEntry(entry, out) : Promise.resolve();
      });
      await Promise.all(walks);
    } else if (e.dataTransfer.files) {
      for (const f of Array.from(e.dataTransfer.files)) out.push(f);
    }
    if (out.length) await onIngest(out);
  }

  return (
    <Card>
      <SectionHeader
        title="Source assets"
        subtitle="Drop a folder, drop multiple files, or use the buttons. Recursive — every image found gets added."
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
              <Upload size={14} /> Add files
            </Button>
            <Button size="sm" variant="secondary" onClick={() => dirRef.current?.click()}>
              <FolderOpen size={14} /> Add folder
            </Button>
          </div>
        }
      />
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cls(
          'rounded-lg border border-dashed p-5 text-center transition',
          dragOver ? 'border-brand-400 bg-brand-500/10' : 'border-ink-600',
        )}
      >
        <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/15 text-brand-200">
          <Upload size={16} />
        </div>
        <div className="mt-2 text-sm font-medium text-white">Drop folders or images here</div>
        <div className="text-xs text-ink-400">JPG / PNG / WEBP — each asset keeps its original dimensions when reskinned.</div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onPickFiles} />
      {/* @ts-expect-error webkitdirectory is non-standard but supported in Chromium / Safari / Edge desktop */}
      <input ref={dirRef} type="file" multiple webkitdirectory="" directory="" className="hidden" onChange={onPickFiles} />
    </Card>
  );
}

async function walkEntry(entry: FileSystemEntry, out: File[]): Promise<void> {
  if (entry.isFile) {
    return new Promise<void>((resolve) => {
      (entry as FileSystemFileEntry).file((f) => {
        if (f.type.startsWith('image/')) out.push(f);
        resolve();
      }, () => resolve());
    });
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const entries: FileSystemEntry[] = await new Promise((resolve) => {
      const acc: FileSystemEntry[] = [];
      function readMore() {
        reader.readEntries((batch) => {
          if (!batch.length) return resolve(acc);
          acc.push(...batch);
          readMore();
        }, () => resolve(acc));
      }
      readMore();
    });
    for (const e of entries) await walkEntry(e, out);
  }
}

// --- LoRA panel ------------------------------------------------------------

function LoraPanel({
  loras, onAddFile, onAddHf, onUpdate, onRemove,
}: {
  loras: ReskinLora[];
  onAddFile: (f: File) => Promise<void>;
  onAddHf: (id: string) => void;
  onUpdate: (id: string, patch: Partial<ReskinLora>) => void;
  onRemove: (id: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [hfDraft, setHfDraft] = useState('');

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-ink-200">LoRAs <span className="font-normal text-ink-400">· optional, fal flux-lora</span></div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()}>
            <Upload size={12} /> Upload .safetensors
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".safetensors,application/octet-stream"
            className="hidden"
            onChange={async (e) => { const f = e.target.files?.[0]; if (f) await onAddFile(f); e.target.value = ''; }}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <TextInput
          value={hfDraft}
          onChange={setHfDraft}
          placeholder="HuggingFace LoRA id  (e.g. alvdansen/flux-koda)"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAddHf(hfDraft); setHfDraft(''); } }}
        />
        <Button size="sm" variant="secondary" onClick={() => { onAddHf(hfDraft); setHfDraft(''); }}>
          <Plus size={12} /> Add HF
        </Button>
      </div>
      {loras.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {loras.map((l) => (
            <li key={l.id} className="flex items-center gap-2 rounded-md border border-ink-700 bg-ink-850 px-2 py-1.5">
              <span className="rounded-md bg-brand-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-brand-200">
                {l.kind === 'file' ? 'file' : 'hf'}
              </span>
              <span className="min-w-0 flex-1 truncate text-[11px] text-ink-100">
                {l.kind === 'file' ? l.fileName : l.huggingfaceId}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-ink-300">
                <span>×</span>
                <input
                  type="range" min={0} max={2} step={0.05} value={l.scale}
                  onChange={(e) => onUpdate(l.id, { scale: Number(e.target.value) })}
                  className="w-20 accent-brand-500"
                />
                <span className="w-8 text-right">{l.scale.toFixed(2)}</span>
              </span>
              <button onClick={() => onRemove(l.id)} className="rounded p-1 text-ink-400 hover:bg-ink-700 hover:text-rose-300" title="Remove LoRA">
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- Asset card ------------------------------------------------------------

function AssetCard({
  asset, onToggle, onRemove, onReskin, disabled,
}: {
  asset: ReskinAsset;
  onToggle: () => void;
  onRemove: () => void;
  onReskin: () => Promise<void>;
  disabled: boolean;
}) {
  const showResult = asset.resultUrl && (asset.status === 'done' || asset.status === 'idle');
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={cls(
        'group relative overflow-hidden rounded-lg border bg-ink-850 transition',
        asset.selected ? 'border-brand-400/60' : 'border-ink-700',
      )}
    >
      <div className="grid grid-cols-2 gap-px bg-ink-900">
        <div className="relative aspect-square">
          <img src={asset.sourceDataUrl} alt="" className="h-full w-full object-cover" />
          <span className="absolute left-1 top-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">SOURCE</span>
        </div>
        <div className="relative aspect-square bg-ink-900">
          {showResult ? (
            <>
              <img src={asset.resultUrl} alt="" className="h-full w-full object-cover" />
              <span className="absolute left-1 top-1 rounded-md bg-emerald-500/85 px-1.5 py-0.5 text-[9px] font-bold text-white">RESKIN</span>
            </>
          ) : asset.status === 'generating' || asset.status === 'queued' ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[10px] text-ink-200">
              <Spinner size={16} className="text-brand-300" />
              <span>{asset.status === 'queued' ? 'queued' : 'reskinning'}</span>
            </div>
          ) : asset.status === 'error' ? (
            <div className="flex h-full w-full items-center justify-center bg-rose-950/40 p-1 text-center text-[9px] text-rose-200">
              {asset.error?.slice(0, 90) ?? 'failed'}
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-ink-500">awaiting reskin</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button onClick={onToggle} className="text-brand-300">
          {asset.selected ? <CheckSquare size={14} /> : <Square size={14} className="text-ink-400" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-medium text-white">{asset.fileName}</div>
          <div className="text-[9px] text-ink-400">{asset.width}×{asset.height}</div>
        </div>
        <button
          onClick={onReskin}
          disabled={disabled || asset.status === 'generating' || asset.status === 'queued'}
          className="rounded p-1 text-ink-300 hover:bg-ink-700 hover:text-white disabled:opacity-40"
          title="Reskin this asset"
        >
          <RefreshCw size={12} />
        </button>
        <button onClick={onRemove} className="rounded p-1 text-ink-400 hover:bg-ink-700 hover:text-rose-300" title="Remove from project">
          <Trash2 size={12} />
        </button>
      </div>
    </motion.div>
  );
}

// --- Animate card ----------------------------------------------------------

function AnimateCard({ asset, onToggle, onAnimate }: { asset: ReskinAsset; onToggle: () => void; onAnimate: () => Promise<void> }) {
  return (
    <div className={cls('overflow-hidden rounded-lg border bg-ink-850', asset.selected ? 'border-brand-400/60' : 'border-ink-700')}>
      <div className="relative aspect-square bg-ink-900">
        {asset.videoUrl ? (
          <video src={asset.videoUrl} className="h-full w-full object-cover" autoPlay loop muted playsInline />
        ) : asset.resultUrl ? (
          <img src={asset.resultUrl} alt="" className="h-full w-full object-cover" />
        ) : null}
        {asset.videoStatus === 'generating' && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/80 py-1 text-[10px] text-white">
            <Spinner size={11} className="text-brand-300" /> animating
          </div>
        )}
        {asset.videoStatus === 'error' && (
          <div className="absolute inset-x-0 bottom-0 bg-rose-900/85 px-1.5 py-1 text-[9px] text-rose-100">
            {asset.videoError?.slice(0, 80) ?? 'video failed'}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button onClick={onToggle} className="text-brand-300">
          {asset.selected ? <CheckSquare size={14} /> : <Square size={14} className="text-ink-400" />}
        </button>
        <div className="min-w-0 flex-1 truncate text-[11px] font-medium text-white">{asset.fileName}</div>
        <button
          onClick={onAnimate}
          disabled={asset.videoStatus === 'generating'}
          className="rounded p-1 text-ink-300 hover:bg-ink-700 hover:text-white disabled:opacity-40"
          title="Animate this asset"
        >
          <Play size={12} />
        </button>
      </div>
    </div>
  );
}

