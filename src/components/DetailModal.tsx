import { Download, Film, Copy, Copy as CopyIcon, RefreshCw, ChevronLeft, ChevronRight, X, Pencil, Sparkles } from 'lucide-react';
import { useStore } from '../state/store';
import { Button, Spinner } from './ui';
import { generateImage, generateSocialCopy, generateVideo, makeAnimatePrompt } from '../lib/api';
import { putGeneration } from '../lib/storage';
import { copyToClipboard, downloadUrl, cls } from '../lib/utils';
import { useEffect, useMemo, useState } from 'react';
import type { Generation, SocialCopy, SocialPlatform } from '../types';

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
    if (g.video?.url) {
      dispatch({ type: 'ui/toast', toast: { kind: 'info', message: 'This already has a video.' } });
      return;
    }
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
    dispatch({ type: 'ui/toast', toast: { kind: 'info', message: 'Animating… checking cache, then Veo if needed.' } });
    try {
      const { url, cached } = await generateVideo({
        apiKeys: state.settings.apiKeys,
        model: state.brief.videoModel,
        prompt: queued.video!.prompt,
        imageUrl: g.imageUrl,
        aspectRatio: g.aspectRatio,
      });
      dispatch({ type: 'ui/toast', toast: { kind: cached ? 'info' : 'success', message: cached ? 'Reused cached video — no API spend.' : 'Video ready.' } });
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
        // User-initiated regen wants a fresh variation, not the cached result.
        bypassCache: true,
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
            {g.parentId && (() => {
              const parent = state.generations.find((x) => x.id === g.parentId);
              return parent ? (
                <button
                  onClick={() => dispatch({ type: 'ui/openDetail', id: parent.id })}
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-400/40 bg-brand-500/10 px-2 py-0.5 text-[11px] text-brand-100 hover:bg-brand-500/20"
                  title="Open the source image this was edited from"
                >
                  ← Edited from "{parent.title}"
                </button>
              ) : null;
            })()}
            {g.editNote && (
              <Meta label="Edit note" value={g.editNote} />
            )}
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

            <SocialCopySection g={g} />

            <div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400">Prompt</div>
              <p className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded-md border border-ink-700 bg-ink-900 p-2 text-xs text-ink-100">{g.prompt}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {g.imageUrl && <Button size="sm" variant="secondary" onClick={() => downloadUrl(g.imageUrl!, `${g.title}-${g.aspectRatio}.png`)}><Download size={14} /> Download image</Button>}
              {g.video?.url && <Button size="sm" variant="secondary" onClick={() => downloadUrl(g.video!.url!, `${g.title}-${g.aspectRatio}.mp4`)}><Download size={14} /> Download video</Button>}
              <Button size="sm" variant="ghost" onClick={() => copyToClipboard(g.prompt)}><Copy size={14} /> Copy prompt</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={regen}><RefreshCw size={14} /> Regenerate</Button>
              {g.imageUrl && (
                <Button size="sm" variant="secondary" onClick={() => dispatch({ type: 'ui/openEditMask', id: g.id })}>
                  <Pencil size={14} /> Edit area
                </Button>
              )}
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

const PLATFORMS: { id: SocialPlatform; label: string; accent: string }[] = [
  { id: 'tiktok',    label: 'TikTok',    accent: 'border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-100' },
  { id: 'instagram', label: 'Instagram', accent: 'border-rose-400/40    bg-rose-500/10    text-rose-100' },
  { id: 'facebook',  label: 'Facebook',  accent: 'border-blue-400/40    bg-blue-500/10    text-blue-100' },
  { id: 'x',         label: 'X',         accent: 'border-ink-500        bg-ink-700/30     text-ink-100' },
];

function socialHashOf(g: Generation): string {
  return `${g.id}::${g.prompt.slice(0, 200)}::${g.title}`;
}

function SocialCopySection({ g }: { g: Generation }) {
  const { state, dispatch } = useStore();
  const [busy, setBusy] = useState(false);
  const [platform, setPlatform] = useState<SocialPlatform>('instagram');

  const expectedHash = socialHashOf(g);
  const current = g.socialCopy && g.socialCopy.hash === expectedHash ? g.socialCopy : null;

  async function generate() {
    if (!state.settings.apiKeys.text?.key) {
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: 'Add your LLM (Text) API key in Settings first.' } });
      dispatch({ type: 'ui/openSettings', open: true });
      return;
    }
    setBusy(true);
    try {
      const byPlatform = await generateSocialCopy({
        apiKeys: state.settings.apiKeys,
        textModel: state.brief.textModel,
        title: g.title,
        prompt: g.prompt,
      });
      const next: Generation = { ...g, socialCopy: { hash: expectedHash, generatedAt: Date.now(), byPlatform } as SocialCopy };
      dispatch({ type: 'generations/upsert', generation: next });
      putGeneration(next);
      dispatch({ type: 'ui/toast', toast: { kind: 'success', message: 'Social copy ready.' } });
    } catch (err: any) {
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: err?.message ?? 'Copy generation failed.' } });
    } finally {
      setBusy(false);
    }
  }

  const data = current?.byPlatform?.[platform];

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">Social copy</div>
        <Button size="sm" variant="ghost" onClick={generate} disabled={busy}>
          {busy ? <Spinner size={12} /> : <Sparkles size={12} />}
          {current ? 'Regenerate' : 'Generate captions'}
        </Button>
      </div>
      {current ? (
        <div className="rounded-md border border-ink-700 bg-ink-900 p-2">
          <div className="mb-1.5 flex flex-wrap gap-1">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPlatform(p.id)}
                className={cls(
                  'rounded-full border px-2 py-0.5 text-[10px] transition active:scale-95',
                  platform === p.id ? p.accent : 'border-ink-700 text-ink-400 hover:text-white',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          {data ? (
            <div className="space-y-2">
              <div>
                <div className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-ink-500">Captions</div>
                <ul className="space-y-1">
                  {data.captions.map((c, i) => (
                    <li key={i} className="group flex items-start gap-1.5 rounded border border-ink-700 bg-ink-850 px-2 py-1">
                      <span className="min-w-0 flex-1 whitespace-pre-wrap text-[11px] text-ink-100">{c}</span>
                      <button onClick={() => { copyToClipboard(c); dispatch({ type: 'ui/toast', toast: { kind: 'info', message: 'Copied caption.' } }); }} className="shrink-0 opacity-0 transition group-hover:opacity-100" title="Copy">
                        <CopyIcon size={11} className="text-ink-400 hover:text-white" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-ink-500">Hashtags</div>
                <div className="flex flex-wrap items-center gap-1">
                  {data.hashtags.map((h) => (
                    <span key={h} className="rounded-full bg-ink-700/50 px-1.5 py-0.5 text-[10px] text-ink-200">{h}</span>
                  ))}
                  <button
                    onClick={() => { copyToClipboard(data.hashtags.join(' ')); dispatch({ type: 'ui/toast', toast: { kind: 'info', message: 'Copied hashtags.' } }); }}
                    className="rounded-full border border-ink-700 px-1.5 py-0.5 text-[10px] text-ink-400 hover:text-white"
                  >
                    <CopyIcon size={10} /> copy all
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-ink-400">No copy for this platform yet.</p>
          )}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-ink-700 px-2 py-1.5 text-[11px] text-ink-400">
          No captions yet — generate platform-tuned captions + hashtags for TikTok, Instagram, Facebook, and X.
        </p>
      )}
    </div>
  );
}
