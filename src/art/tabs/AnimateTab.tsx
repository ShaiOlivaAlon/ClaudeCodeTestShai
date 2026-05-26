import { useState } from 'react';
import { Play, Loader2, AlertTriangle, CheckCircle2, Download } from 'lucide-react';
import { useArt } from '../store';
import AssetGrid from '../components/AssetGrid';
import ProviderPicker from '../components/ProviderPicker';
import { VIDEO_MODELS } from '../providers/registry';
import { getVideoProvider } from '../providers';
import { getSource, putVideo } from '../utils/storage';
import { blobToDataUrl, newId } from '../utils/assets';
import { AnimationResult } from '../types';

export default function AnimateTab() {
  const {
    assets,
    selectedAssetIds,
    toggleSelected,
    selectAll,
    selectNone,
    reskinResults,
    animations,
    upsertAnimation,
    removeAnimation,
    animateSettings,
    setAnimateSettings,
    keys,
  } = useArt();

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'originals' | 'reskins'>('originals');

  const setS = (patch: Partial<typeof animateSettings>) =>
    setAnimateSettings({ ...animateSettings, ...patch });

  const candidates = source === 'originals'
    ? assets.filter((a) => selectedAssetIds.has(a.id))
    : reskinResults.filter((r) => r.status === 'done');

  async function runAnimate() {
    if (!animateSettings.prompt.trim()) {
      setError('Add a motion/animation prompt.');
      return;
    }
    if (candidates.length === 0) {
      setError(source === 'originals' ? 'Select source assets first.' : 'Generate reskins first or switch to originals.');
      return;
    }
    setError(null);
    setRunning(true);
    setProgress({ done: 0, total: candidates.length });

    const provider = getVideoProvider(animateSettings.providerId);

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const isAsset = 'mime' in c;
      const sourceId = isAsset ? c.id : c.sourceId;
      const path = isAsset ? c.path : c.path;

      const placeholder: AnimationResult = {
        id: newId(),
        sourceId,
        path,
        videoUrl: '',
        status: 'running',
        providerId: animateSettings.providerId,
        model: animateSettings.model,
        createdAt: Date.now(),
      };
      upsertAnimation(placeholder);

      try {
        let sourceDataUrl: string;
        if (isAsset) {
          const blob = await getSource(c.id);
          if (!blob) throw new Error('Source missing');
          sourceDataUrl = await blobToDataUrl(blob);
        } else {
          const resp = await fetch(c.previewUrl);
          sourceDataUrl = await blobToDataUrl(await resp.blob());
        }

        const placeholderAsset = isAsset
          ? c
          : {
              id: c.id,
              path: c.path,
              name: c.path,
              width: c.width,
              height: c.height,
              mime: 'image/png',
              bytes: 0,
              previewUrl: c.previewUrl,
            };

        const output = await provider.generate(
          {
            source: placeholderAsset,
            sourceDataUrl,
            prompt: animateSettings.prompt,
            model: animateSettings.model,
            durationSec: animateSettings.durationSec,
            motionStrength: animateSettings.motionStrength,
          },
          keys
        );
        const resp = await fetch(output.videoUrl);
        await putVideo(placeholder.id, await resp.blob());
        upsertAnimation({
          ...placeholder,
          status: 'done',
          videoUrl: output.videoUrl,
          durationSec: output.durationSec,
        });
      } catch (err) {
        upsertAnimation({
          ...placeholder,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
      }
      setProgress({ done: i + 1, total: candidates.length });
    }

    setRunning(false);
  }

  return (
    <div className="space-y-6 p-4 max-w-6xl mx-auto">
      <section>
        <h2 className="text-lg font-bold mb-2">1 · Choose source</h2>
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setSource('originals')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
              source === 'originals' ? 'bg-primary-500 text-white' : 'bg-primary-50 text-primary-700'
            }`}
          >
            Original assets ({assets.length})
          </button>
          <button
            type="button"
            onClick={() => setSource('reskins')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
              source === 'reskins' ? 'bg-primary-500 text-white' : 'bg-primary-50 text-primary-700'
            }`}
          >
            Reskinned ({reskinResults.filter((r) => r.status === 'done').length})
          </button>
        </div>
        {source === 'originals' ? (
          <>
            <div className="flex items-center gap-2 text-sm mb-2">
              <button onClick={selectAll} className="text-primary-600 font-semibold">Select all</button>
              <button onClick={selectNone} className="text-gray-600">Clear</button>
              <span className="ml-auto text-gray-500">{selectedAssetIds.size} selected</span>
            </div>
            <AssetGrid
              assets={assets}
              selectedIds={selectedAssetIds}
              onToggle={toggleSelected}
              emptyHint="Upload originals in the Reskin tab first."
            />
          </>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {reskinResults
              .filter((r) => r.status === 'done')
              .map((r) => (
                <div key={r.id} className="card overflow-hidden">
                  <div className="aspect-square bg-gray-100 flex items-center justify-center">
                    <img src={r.previewUrl} className="max-w-full max-h-full object-contain" alt={r.path} />
                  </div>
                  <div className="p-2 text-[11px] truncate font-mono">{r.path}</div>
                </div>
              ))}
            {reskinResults.filter((r) => r.status === 'done').length === 0 && (
              <div className="text-sm text-gray-500 italic py-6 text-center col-span-full">
                No completed reskins yet.
              </div>
            )}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">2 · Animation prompt</h2>
        <textarea
          value={animateSettings.prompt}
          onChange={(e) => setS({ prompt: e.target.value })}
          className="input-field min-h-[100px]"
          placeholder="e.g. Gentle idle bobbing animation, subtle camera push-in, leaves drifting in the breeze."
        />
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">3 · Engine</h2>
        <ProviderPicker
          capability="video"
          value={animateSettings.providerId}
          onChange={(id) => {
            const models = VIDEO_MODELS[id];
            setS({ providerId: id, model: models[0] ?? '' });
          }}
          models={VIDEO_MODELS[animateSettings.providerId] ?? []}
          model={animateSettings.model}
          onModelChange={(m) => setS({ model: m })}
        />
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="text-xs font-semibold text-gray-700">Duration (s)</label>
            <input
              type="number"
              min={1}
              max={20}
              value={animateSettings.durationSec}
              onChange={(e) => setS({ durationSec: parseInt(e.target.value, 10) })}
              className="input-field mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700">Motion strength</label>
            <input
              type="number"
              step={0.05}
              min={0}
              max={1}
              value={animateSettings.motionStrength}
              onChange={(e) => setS({ motionStrength: parseFloat(e.target.value) })}
              className="input-field mt-1"
            />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">4 · Run</h2>
        <button
          onClick={runAnimate}
          disabled={running}
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {running
            ? `Animating ${progress.done}/${progress.total}…`
            : `Animate ${candidates.length} asset${candidates.length === 1 ? '' : 's'}`}
        </button>
        {error && (
          <div className="mt-3 flex items-center gap-2 text-red-700 bg-red-50 rounded-lg p-2 text-sm">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}
        {animations.length > 0 && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {animations.map((a) => (
              <div key={a.id} className="card p-2 space-y-2">
                <div className="aspect-video bg-gray-100 rounded-md overflow-hidden flex items-center justify-center">
                  {a.status === 'done' ? (
                    <video src={a.videoUrl} controls className="w-full h-full" />
                  ) : a.status === 'error' ? (
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                  ) : (
                    <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                  )}
                </div>
                <div className="text-[11px] font-mono truncate">{a.path}</div>
                <div className="flex items-center justify-between text-[10px]">
                  {a.status === 'done' ? (
                    <>
                      <span className="inline-flex items-center gap-1 text-green-700">
                        <CheckCircle2 className="w-3 h-3" /> {a.durationSec ?? '?'}s
                      </span>
                      <a
                        href={a.videoUrl}
                        download={`${a.path.replace(/[/\\]/g, '_')}.mp4`}
                        className="text-primary-600 inline-flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" /> Save
                      </a>
                    </>
                  ) : a.status === 'error' ? (
                    <span className="text-red-600 break-words">{a.error}</span>
                  ) : (
                    <span>running…</span>
                  )}
                  <button
                    onClick={() => removeAnimation(a.id)}
                    className="text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
