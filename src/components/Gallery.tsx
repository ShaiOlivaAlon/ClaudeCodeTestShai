import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Film, Image as ImageIcon, Trash2, RefreshCw, Maximize2, Copy, Pencil } from 'lucide-react';
import type { Generation } from '../types';
import { useStore } from '../state/store';
import { Button, EmptyState, Spinner } from './ui';
import { generateImage, generateVideo, makeAnimatePrompt } from '../lib/api';
import { deleteGeneration, putGeneration } from '../lib/storage';
import { cls, copyToClipboard, downloadUrl, shortText } from '../lib/utils';

export function Gallery() {
  const { state, dispatch } = useStore();
  const activeProject = state.projects.find((p) => p.id === state.activeProjectId) ?? null;
  // Filter by the active project. null = "All projects" = no filter.
  const generations = activeProject
    ? state.generations.filter((g) => g.projectId === activeProject.id)
    : state.generations;

  async function clearVisible() {
    const label = activeProject ? `from "${activeProject.name}"` : 'from the gallery';
    if (!confirm(`Remove all ${generations.length} render${generations.length === 1 ? '' : 's'} ${label}?`)) return;
    for (const g of generations) await deleteGeneration(g.id);
    if (activeProject) {
      // Only drop the filtered subset from state.
      dispatch({ type: 'generations/set', generations: state.generations.filter((g) => g.projectId !== activeProject.id) });
    } else {
      dispatch({ type: 'generations/clear' });
    }
  }

  return (
    <aside className="flex h-full flex-col overflow-hidden bg-ink-900 lg:border-l lg:border-ink-800">
      <div className="flex items-center justify-between border-b border-ink-800 px-4 py-3">
        <div className="min-w-0">
          <div className="font-display text-sm font-semibold uppercase tracking-wider text-ink-100">Gallery</div>
          <div className="flex items-center gap-1.5 truncate text-xs text-ink-400">
            <span>{generations.length} render{generations.length === 1 ? '' : 's'}</span>
            {activeProject && (
              <>
                <span className="text-ink-600">·</span>
                <span className="inline-flex items-center gap-1 truncate text-ink-300">
                  <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: activeProject.color }} />
                  {activeProject.name}
                </span>
              </>
            )}
          </div>
        </div>
        {generations.length > 0 && (
          <button onClick={clearVisible} className="text-xs text-ink-400 hover:text-white">
            clear
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {generations.length === 0 ? (
          <EmptyState
            icon={<ImageIcon size={24} />}
            title={activeProject ? 'No renders in this project yet' : 'Nothing rendered yet'}
            hint={activeProject ? 'Switch to "All projects" in the header to see renders from other projects.' : 'Build a brief, generate ideas, tick the ones you love, then hit Generate images.'}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {generations.map((g) => <GalleryCard key={g.id} g={g} />)}
          </div>
        )}
      </div>
    </aside>
  );
}

function GalleryCard({ g }: { g: Generation }) {
  const { state, dispatch } = useStore();
  const [busy, setBusy] = useState(false);

  async function animate() {
    if (!g.imageUrl) return;
    if (g.video?.url) {
      dispatch({ type: 'ui/toast', toast: { kind: 'info', message: 'This already has a video — open it to view.' } });
      return;
    }
    if (!state.settings.apiKeys.video?.key) {
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: 'Add a Video API key in Settings.' } });
      return;
    }
    const animPrompt = makeAnimatePrompt({ title: g.title, description: '', prompt: g.prompt });
    const queued: Generation = { ...g, video: { status: 'generating', model: state.brief.videoModel, prompt: animPrompt } };
    dispatch({ type: 'generations/upsert', generation: queued });
    dispatch({ type: 'ui/toast', toast: { kind: 'info', message: 'Animating… checking cache, then Veo if needed.' } });
    setBusy(true);
    try {
      const { url, cached } = await generateVideo({
        apiKeys: state.settings.apiKeys,
        model: state.brief.videoModel,
        prompt: animPrompt,
        imageUrl: g.imageUrl,
        aspectRatio: g.aspectRatio,
      });
      dispatch({ type: 'ui/toast', toast: { kind: cached ? 'info' : 'success', message: cached ? 'Reused cached video — no API spend.' : 'Video ready.' } });
      const done: Generation = { ...queued, video: { ...queued.video!, status: 'done', url } };
      dispatch({ type: 'generations/upsert', generation: done });
      putGeneration(done);
    } catch (err: any) {
      const failed: Generation = { ...queued, video: { ...queued.video!, status: 'error', error: err?.message ?? 'video failed' } };
      dispatch({ type: 'generations/upsert', generation: failed });
      putGeneration(failed);
    } finally {
      setBusy(false);
    }
  }

  async function regenerate() {
    if (!state.settings.apiKeys.image?.key) {
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: 'Add an Image API key in Settings.' } });
      return;
    }
    setBusy(true);
    const queued: Generation = { ...g, status: 'generating' };
    dispatch({ type: 'generations/upsert', generation: queued });
    try {
      const refs = state.assets.filter((a) => g.referenceAssetIds.includes(a.id)).slice(0, 3);
      const { url } = await generateImage({
        apiKeys: state.settings.apiKeys,
        model: g.imageModel,
        prompt: g.prompt,
        aspectRatio: g.aspectRatio,
        referenceDataUrls: refs.map((a) => a.dataUrl),
        // User-initiated regen wants a fresh variation, not the cached result.
        bypassCache: true,
      });
      const done: Generation = { ...queued, status: 'done', imageUrl: url, createdAt: Date.now() };
      dispatch({ type: 'generations/upsert', generation: done });
      putGeneration(done);
    } catch (err: any) {
      const failed: Generation = { ...queued, status: 'error', error: err?.message };
      dispatch({ type: 'generations/upsert', generation: failed });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    await deleteGeneration(g.id);
    dispatch({ type: 'generations/remove', id: g.id });
  }

  // Brief success pulse when a render finishes (status transitions generating -> done).
  const [pulse, setPulse] = useState(false);
  const prevStatus = useRef<typeof g.status>(g.status);
  useEffect(() => {
    if (prevStatus.current !== 'done' && g.status === 'done') {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 1200);
      return () => clearTimeout(t);
    }
    prevStatus.current = g.status;
  }, [g.status]);

  const parent = g.parentId ? state.generations.find((x) => x.id === g.parentId) : null;

  return (
    <motion.div
      animate={{ boxShadow: pulse ? '0 0 0 3px rgba(70,210,140,0.7)' : '0 0 0 0 rgba(70,210,140,0)' }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="group relative overflow-hidden rounded-lg border border-ink-700 bg-ink-850"
    >
      <div className="relative aspect-square w-full bg-ink-800">
        {g.status === 'generating' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink-900/90 text-xs text-ink-200">
            <Spinner size={20} className="text-brand-300" />
            <span className="mt-2">Rendering {g.aspectRatio}…</span>
          </div>
        )}
        {g.status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-rose-950/40 p-2 text-center text-[11px] text-rose-200">
            <span className="font-semibold">Failed</span>
            <span className="mt-1 line-clamp-3">{shortText(g.error ?? '', 200)}</span>
          </div>
        )}
        {g.imageUrl && (
          <img
            src={g.imageUrl}
            alt={g.title}
            className={cls('h-full w-full object-cover', g.status !== 'done' && 'opacity-40')}
            onClick={() => dispatch({ type: 'ui/openDetail', id: g.id })}
          />
        )}
        {g.video?.status === 'done' && g.video.url && (
          <video src={g.video.url} className="absolute inset-0 h-full w-full object-cover" loop autoPlay muted playsInline />
        )}
        <span className="absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
          {g.aspectRatio}
        </span>
        {g.video?.status === 'generating' && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-black/80 py-1.5 text-[11px] font-semibold text-white">
            <Spinner size={12} className="text-brand-300" />
            <span>Animating… (Veo, can take minutes)</span>
          </div>
        )}
        {g.video?.status === 'error' && (
          <div className="absolute inset-x-0 bottom-0 max-h-[60%] overflow-y-auto bg-rose-900/85 px-2 py-1.5 text-[10px] leading-snug text-rose-100">
            <div className="mb-0.5 font-semibold">Video failed — tap card to see full error</div>
            <div className="whitespace-pre-wrap break-words">{g.video.error ?? 'unknown error'}</div>
          </div>
        )}
        {g.video?.status === 'done' && (
          <span className="absolute right-1.5 top-1.5 rounded-md bg-emerald-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white">VIDEO</span>
        )}
      </div>

      <div className="px-2 py-1.5">
        <div className="truncate text-xs font-semibold text-white">{g.title}</div>
        {parent && (
          <button
            onClick={() => dispatch({ type: 'ui/openDetail', id: parent.id })}
            className="mt-0.5 truncate text-[10px] text-ink-400 hover:text-brand-200"
            title={`Edited from: ${parent.title}`}
          >
            ← edited from "{parent.title}"
          </button>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex translate-y-0 items-center justify-between gap-1 border-t border-ink-700 bg-ink-900/95 p-1.5 transition-transform lg:translate-y-full lg:group-hover:translate-y-0">
        <div className="flex gap-1">
          <button onClick={() => dispatch({ type: 'ui/openDetail', id: g.id })} title="Open" className="rounded-md p-1.5 text-ink-200 hover:bg-ink-700 hover:text-white">
            <Maximize2 size={14} />
          </button>
          {g.imageUrl && (
            <button onClick={() => downloadUrl(g.imageUrl!, `${g.title}-${g.aspectRatio}.png`)} title="Download image" className="rounded-md p-1.5 text-ink-200 hover:bg-ink-700 hover:text-white">
              <Download size={14} />
            </button>
          )}
          {g.video?.url && (
            <button onClick={() => downloadUrl(g.video!.url!, `${g.title}-${g.aspectRatio}.mp4`)} title="Download video" className="rounded-md p-1.5 text-emerald-300 hover:bg-ink-700 hover:text-white">
              <Download size={14} />
            </button>
          )}
        </div>
        <div className="flex gap-1">
          {g.imageUrl && !g.video?.url && (
            <button disabled={busy || g.video?.status === 'generating'} onClick={animate} title="Animate to video" className="inline-flex items-center gap-1 rounded-md bg-brand-500/20 px-2 py-1.5 text-[10px] font-bold text-brand-100 transition active:scale-95 hover:bg-brand-500/30 disabled:opacity-50">
              <Film size={12} /> Animate
            </button>
          )}
          {g.imageUrl && (
            <button
              onClick={() => dispatch({ type: 'ui/openEditMask', id: g.id })}
              title="Edit a region (inpaint)"
              className="rounded-md p-1.5 text-ink-200 transition active:scale-95 hover:bg-ink-700 hover:text-white"
            >
              <Pencil size={14} />
            </button>
          )}
          <button onClick={regenerate} disabled={busy} title="Regenerate (fresh variation)" className="rounded-md p-1.5 text-ink-200 transition active:scale-95 hover:bg-ink-700 hover:text-white">
            <RefreshCw size={14} />
          </button>
          <button onClick={() => copyToClipboard(g.prompt)} title="Copy prompt" className="rounded-md p-1.5 text-ink-200 transition active:scale-95 hover:bg-ink-700 hover:text-white">
            <Copy size={14} />
          </button>
          <button onClick={remove} title="Delete" className="rounded-md p-1.5 text-rose-300 transition active:scale-95 hover:bg-ink-700 hover:text-white">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
