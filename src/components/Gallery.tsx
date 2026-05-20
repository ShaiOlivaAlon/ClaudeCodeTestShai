import { useState } from 'react';
import { Download, Film, Image as ImageIcon, Trash2, RefreshCw, Maximize2, Copy } from 'lucide-react';
import type { Generation } from '../types';
import { useStore } from '../state/store';
import { Button, EmptyState, Spinner } from './ui';
import { generateImage, generateVideo, makeAnimatePrompt } from '../lib/api';
import { deleteGeneration, putGeneration } from '../lib/storage';
import { cls, copyToClipboard, downloadUrl, shortText } from '../lib/utils';

export function Gallery() {
  const { state, dispatch } = useStore();
  const generations = state.generations;

  return (
    <aside className="flex h-full flex-col overflow-hidden border-l border-ink-800 bg-ink-900">
      <div className="flex items-center justify-between border-b border-ink-800 px-4 py-3">
        <div>
          <div className="font-display text-sm font-semibold uppercase tracking-wider text-ink-100">Gallery</div>
          <div className="text-xs text-ink-400">{generations.length} renders</div>
        </div>
        {generations.length > 0 && (
          <button
            onClick={async () => {
              if (!confirm('Remove all generations from gallery?')) return;
              for (const g of generations) await deleteGeneration(g.id);
              dispatch({ type: 'generations/clear' });
            }}
            className="text-xs text-ink-400 hover:text-white"
          >
            clear
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {generations.length === 0 ? (
          <EmptyState icon={<ImageIcon size={24} />} title="Nothing rendered yet" hint="Build a brief, generate ideas, tick the ones you love, then hit Generate images." />
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
    if (!state.settings.apiKeys.video?.key) {
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: 'Add a Video API key in Settings.' } });
      return;
    }
    const animPrompt = makeAnimatePrompt({ title: g.title, description: '', prompt: g.prompt });
    const queued: Generation = { ...g, video: { status: 'generating', model: state.brief.videoModel, prompt: animPrompt } };
    dispatch({ type: 'generations/upsert', generation: queued });
    setBusy(true);
    try {
      const { url } = await generateVideo({
        apiKeys: state.settings.apiKeys,
        model: state.brief.videoModel,
        prompt: animPrompt,
        imageUrl: g.imageUrl,
        aspectRatio: g.aspectRatio,
      });
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

  return (
    <div className="group relative overflow-hidden rounded-lg border border-ink-700 bg-ink-850">
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
          <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
            <Spinner size={10} /> animating
          </span>
        )}
        {g.video?.status === 'done' && (
          <span className="absolute right-1.5 top-1.5 rounded-md bg-emerald-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white">VIDEO</span>
        )}
      </div>

      <div className="px-2 py-1.5">
        <div className="truncate text-xs font-semibold text-white">{g.title}</div>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-between gap-1 border-t border-ink-700 bg-ink-900/95 p-1.5 transition-transform group-hover:translate-y-0">
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
            <button disabled={busy || g.video?.status === 'generating'} onClick={animate} title="Animate to video" className="inline-flex items-center gap-1 rounded-md bg-brand-500/20 px-2 py-1.5 text-[10px] font-bold text-brand-100 hover:bg-brand-500/30 disabled:opacity-50">
              <Film size={12} /> Animate
            </button>
          )}
          <button onClick={regenerate} disabled={busy} title="Regenerate" className="rounded-md p-1.5 text-ink-200 hover:bg-ink-700 hover:text-white">
            <RefreshCw size={14} />
          </button>
          <button onClick={() => copyToClipboard(g.prompt)} title="Copy prompt" className="rounded-md p-1.5 text-ink-200 hover:bg-ink-700 hover:text-white">
            <Copy size={14} />
          </button>
          <button onClick={remove} title="Delete" className="rounded-md p-1.5 text-rose-300 hover:bg-ink-700 hover:text-white">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
