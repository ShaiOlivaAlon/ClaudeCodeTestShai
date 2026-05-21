import { Download, Film, Copy, RefreshCw, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useStore } from '../state/store';
import { Button, Spinner } from './ui';
import { generateImage, generateVideo, makeAnimatePrompt } from '../lib/api';
import { putGeneration } from '../lib/storage';
import { copyToClipboard, downloadUrl, cls } from '../lib/utils';
import { useEffect, useMemo, useState } from 'react';
import type { Generation } from '../types';

export function DetailModal() {
  const { state, dispatch } = useStore();
  const id = state.ui.detailGenerationId;
  // The gallery list is the navigation order. Keep a stable index even if a render finishes mid-view.
  const list = state.generations;
  const idx = useMemo(() => list.findIndex((g) => g.id === id), [list, id]);
  const g = idx >= 0 ? list[idx] : null;

  function go(delta: number) {
    if (idx < 0) return;
    const next = idx + delta;
    if (next < 0 || next >= list.length) return;
    dispatch({ type: 'ui/openDetail', id: list[next].id });
  }

  // Keyboard nav: ←/→ to step, Esc to close. Bound at the modal level so it doesn't fight inputs elsewhere.
  useEffect(() => {
    if (!g) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === 'Escape') { dispatch({ type: 'ui/openDetail', id: null }); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [g, idx, list.length]);

  if (!g) return null;
  return (
    <DetailModalBody
      g={g}
      hasPrev={idx > 0}
      hasNext={idx >= 0 && idx < list.length - 1}
      position={`${idx + 1} / ${list.length}`}
      onPrev={() => go(-1)}
      onNext={() => go(1)}
      onClose={() => dispatch({ type: 'ui/openDetail', id: null })}
    />
  );
}

function DetailModalBody({
  g, hasPrev, hasNext, position, onPrev, onNext, onClose,
}: {
  g: Generation;
  hasPrev: boolean;
  hasNext: boolean;
  position: string;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const { state, dispatch } = useStore();
  const [busy, setBusy] = useState(false);

  const usedAssets = state.assets.filter((a) => g.referenceAssetIds.includes(a.id));

  async function animate() {
    if (!g.imageUrl) return;
    if (!state.settings.apiKeys.video?.key) {
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: 'Add a Video API key in Settings to animate.' } });
      dispatch({ type: 'ui/openSettings', open: true });
      return;
    }
    setBusy(true);
    const queued: Generation = {
      ...g,
      video: {
        status: 'generating',
        model: state.brief.videoModel,
        prompt: makeAnimatePrompt({ title: g.title, description: '', prompt: g.prompt }),
      },
    };
    dispatch({ type: 'generations/upsert', generation: queued });
    dispatch({ type: 'ui/toast', toast: { kind: 'info', message: 'Animating… Veo can take a few minutes. The card will update when it\'s ready.' } });
    try {
      const { url } = await generateVideo({
        apiKeys: state.settings.apiKeys,
        model: state.brief.videoModel,
        prompt: queued.video!.prompt,
        imageUrl: g.imageUrl,
        aspectRatio: g.aspectRatio,
      });
      const done: Generation = { ...queued, video: { ...queued.video!, status: 'done', url } };
      dispatch({ type: 'generations/upsert', generation: done });
      putGeneration(done);
    } catch (err: any) {
      const failed: Generation = { ...queued, video: { ...queued.video!, status: 'error', error: err?.message ?? 'failed' } };
      dispatch({ type: 'generations/upsert', generation: failed });
    } finally { setBusy(false); }
  }

  async function regen() {
    if (!state.settings.apiKeys.image?.key) return;
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
      const done: Generation = { ...queued, status: 'done', imageUrl: url };
      dispatch({ type: 'generations/upsert', generation: done });
      putGeneration(done);
    } catch (err: any) {
      const failed: Generation = { ...queued, status: 'error', error: err?.message };
      dispatch({ type: 'generations/upsert', generation: failed });
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 px-2 py-4 backdrop-blur-sm sm:px-4 sm:py-10" onClick={onClose}>
      {/* Edge prev/next click zones — large but unobtrusive. */}
      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="fixed left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-3 text-white opacity-80 hover:bg-black/80 hover:opacity-100"
          title="Previous (←)"
        >
          <ChevronLeft size={24} />
        </button>
      )}
      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="fixed right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-3 text-white opacity-80 hover:bg-black/80 hover:opacity-100"
          title="Next (→)"
        >
          <ChevronRight size={24} />
        </button>
      )}

      <div
        className="relative w-full max-w-4xl rounded-2xl border border-ink-700 bg-ink-900 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-ink-700 px-5 py-3">
          <h2 className="truncate font-display text-lg font-semibold text-white">{g.title}</h2>
          <div className="flex items-center gap-2 text-xs text-ink-300">
            <span>{position}</span>
            <button onClick={onClose} className="rounded-md p-1.5 text-ink-300 hover:bg-ink-800 hover:text-white" title="Close (Esc)">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-[1.4fr_1fr]">
          <div className="overflow-hidden rounded-lg border border-ink-700 bg-ink-900">
            {g.video?.url ? (
              <video src={g.video.url} className="h-full w-full" controls autoPlay loop />
            ) : g.imageUrl ? (
              <img src={g.imageUrl} alt={g.title} className="h-full w-full object-contain" />
            ) : (
              <div className="flex aspect-square items-center justify-center text-ink-400"><Spinner size={28} /></div>
            )}
          </div>
          <div className="space-y-3">
            <Meta label="Aspect ratio" value={g.aspectRatio} />
            <Meta label="Image model" value={g.imageModel} />
            {g.video && <Meta label="Video model" value={g.video.model} />}
            <Meta label="Created" value={new Date(g.createdAt).toLocaleString()} />

            {(g.chosenSeason || g.chosenTheme || g.chosenStyle) && (
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400">Concept axes</div>
                <div className="flex flex-wrap gap-1.5">
                  {g.chosenSeason && <AxisChip kind="season" value={g.chosenSeason} />}
                  {g.chosenTheme  && <AxisChip kind="theme"  value={g.chosenTheme} />}
                  {g.chosenStyle  && <AxisChip kind="style"  value={g.chosenStyle} />}
                </div>
              </div>
            )}

            {usedAssets.length > 0 && (
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400">Assets used</div>
                <ul className="space-y-1 text-[11px] text-ink-200">
                  {usedAssets.map((a) => (
                    <li key={a.id} className="flex items-center gap-2">
                      <img src={a.dataUrl} alt={a.name} className="h-6 w-6 rounded border border-ink-700 object-cover" />
                      <span className="font-medium text-ink-100">{a.name}</span>
                      {a.description && <span className="truncate text-ink-400">— {a.description}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {g.video?.status === 'error' && (
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-rose-300">Video error</div>
                <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-rose-500/50 bg-rose-950/40 p-2 text-[11px] text-rose-100">{g.video.error ?? 'unknown error'}</p>
              </div>
            )}
            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400">Prompt</div>
              <p className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded-md border border-ink-700 bg-ink-900 p-2 text-xs text-ink-100">{g.prompt}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {g.imageUrl && <Button size="sm" variant="secondary" onClick={() => downloadUrl(g.imageUrl!, `${g.title}-${g.aspectRatio}.png`)}><Download size={14} /> Download image</Button>}
              {g.video?.url && <Button size="sm" variant="secondary" onClick={() => downloadUrl(g.video!.url!, `${g.title}-${g.aspectRatio}.mp4`)}><Download size={14} /> Download video</Button>}
              <Button size="sm" variant="ghost" onClick={() => copyToClipboard(g.prompt)}><Copy size={14} /> Copy prompt</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={regen}><RefreshCw size={14} /> Regenerate</Button>
              {g.imageUrl && !g.video?.url && (
                <Button size="sm" onClick={animate} disabled={busy || g.video?.status === 'generating'}>
                  {g.video?.status === 'generating' ? <Spinner size={14} /> : <Film size={14} />}
                  {g.video?.status === 'generating' ? 'Animating…' : 'Animate to video'}
                </Button>
              )}
            </div>
            <p className="text-[10px] text-ink-500">Tip: use ← / → to step through, Esc to close.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AxisChip({ kind, value }: { kind: 'season' | 'theme' | 'style'; value: string }) {
  const tone = kind === 'season'
    ? 'border-amber-400/50 bg-amber-500/10 text-amber-100'
    : kind === 'theme'
      ? 'border-brand-400/50 bg-brand-500/10 text-brand-100'
      : 'border-emerald-400/50 bg-emerald-500/10 text-emerald-100';
  const label = kind === 'season' ? 'Season' : kind === 'theme' ? 'Theme' : 'Style';
  return (
    <span className={cls('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]', tone)}>
      <span className="opacity-70">{label}:</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-xs">
      <span className="mr-2 inline-block w-28 text-ink-400">{label}</span>
      <span className="text-ink-100">{value}</span>
    </div>
  );
}
