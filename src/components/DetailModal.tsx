import { Download, Film, Copy, RefreshCw } from 'lucide-react';
import { useStore } from '../state/store';
import { Button, Modal, Spinner } from './ui';
import { generateImage, generateVideo, makeAnimatePrompt } from '../lib/api';
import { putGeneration } from '../lib/storage';
import { copyToClipboard, downloadUrl } from '../lib/utils';
import { useState } from 'react';
import type { Generation } from '../types';

export function DetailModal() {
  const { state, dispatch } = useStore();
  const id = state.ui.detailGenerationId;
  const g = state.generations.find((x) => x.id === id);
  if (!g) return null;
  return <DetailModalBody g={g} />;
}

function DetailModalBody({ g }: { g: Generation }) {
  const { state, dispatch } = useStore();
  const [busy, setBusy] = useState(false);

  async function animate() {
    if (!g.imageUrl || !state.settings.apiKeys.video?.key) return;
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
    <Modal open onClose={() => dispatch({ type: 'ui/openDetail', id: null })} title={g.title} wide>
      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
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
        </div>
      </div>
    </Modal>
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
