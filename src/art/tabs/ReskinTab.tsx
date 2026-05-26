import { useState, useMemo } from 'react';
import { Play, Download, Trash2, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useArt } from '../store';
import FolderDrop from '../components/FolderDrop';
import AssetGrid from '../components/AssetGrid';
import ProviderPicker from '../components/ProviderPicker';
import LoRAManager from '../components/LoRAManager';
import StyleRefPicker from '../components/StyleRefPicker';
import { IMAGE_MODELS } from '../providers/registry';
import { getImageProvider } from '../providers';
import { getSource, getResult, putResult } from '../utils/storage';
import { blobToDataUrl, newId, resizeToDimensions } from '../utils/assets';
import { ReskinResult } from '../types';
import { downloadZip } from '../utils/zip';

export default function ReskinTab() {
  const {
    assets,
    addAssets,
    removeAsset,
    clearAssets,
    selectedAssetIds,
    toggleSelected,
    selectAll,
    selectNone,
    reskinSettings,
    setReskinSettings,
    reskinResults,
    upsertReskin,
    clearReskinResults,
    keys,
  } = useArt();

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const targetAssets = useMemo(() => {
    if (selectedAssetIds.size === 0) return assets;
    return assets.filter((a) => selectedAssetIds.has(a.id));
  }, [assets, selectedAssetIds]);

  const setS = (patch: Partial<typeof reskinSettings>) =>
    setReskinSettings({ ...reskinSettings, ...patch });

  async function runReskin() {
    if (!reskinSettings.prompt.trim()) {
      setError('Add a prompt describing the new theme.');
      return;
    }
    if (targetAssets.length === 0) {
      setError('Add at least one source asset.');
      return;
    }
    setError(null);
    setRunning(true);
    setProgress({ done: 0, total: targetAssets.length });

    const provider = getImageProvider(reskinSettings.providerId);

    for (let i = 0; i < targetAssets.length; i++) {
      const a = targetAssets[i];
      const result: ReskinResult = {
        id: newId(),
        sourceId: a.id,
        path: a.path,
        previewUrl: '',
        width: a.width,
        height: a.height,
        status: 'running',
        providerId: reskinSettings.providerId,
        model: reskinSettings.model,
        createdAt: Date.now(),
      };
      upsertReskin(result);

      try {
        const blob = await getSource(a.id);
        if (!blob) throw new Error('Source missing from storage');
        const sourceDataUrl = await blobToDataUrl(blob);

        const output = await provider.generate(
          {
            source: a,
            sourceDataUrl,
            prompt: reskinSettings.prompt,
            negativePrompt: reskinSettings.negativePrompt,
            strength: reskinSettings.strength,
            guidance: reskinSettings.guidance,
            steps: reskinSettings.steps,
            seed: reskinSettings.seed,
            model: reskinSettings.model,
            loras: reskinSettings.loras.filter((l) => l.url.trim()),
            styleRefs: reskinSettings.styleRefs,
            width: a.width,
            height: a.height,
          },
          keys
        );

        let finalUrl = output.previewUrl;
        let finalW = output.width;
        let finalH = output.height;
        if (
          reskinSettings.preserveSize &&
          (output.width !== a.width || output.height !== a.height)
        ) {
          const resized = await resizeToDimensions(output.previewUrl, a.width, a.height);
          URL.revokeObjectURL(output.previewUrl);
          finalUrl = URL.createObjectURL(resized);
          finalW = a.width;
          finalH = a.height;
          await putResult(result.id, resized);
        } else {
          const r = await fetch(output.previewUrl);
          const b = await r.blob();
          await putResult(result.id, b);
        }

        upsertReskin({
          ...result,
          status: 'done',
          previewUrl: finalUrl,
          width: finalW,
          height: finalH,
        });
      } catch (err) {
        upsertReskin({
          ...result,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
      }
      setProgress({ done: i + 1, total: targetAssets.length });
    }

    setRunning(false);
  }

  async function downloadAllReskins() {
    const done = reskinResults.filter((r) => r.status === 'done');
    const entries: { path: string; blob: Blob }[] = [];
    for (const r of done) {
      const blob = await getResult(r.id);
      if (blob) {
        const ext = r.path.match(/\.([^./]+)$/)?.[1] ?? 'png';
        const base = r.path.replace(/\.[^./]+$/, '');
        entries.push({ path: `${base}_reskin.${ext}`, blob });
      }
    }
    await downloadZip('reskin.zip', entries);
  }

  return (
    <div className="space-y-6 p-4 max-w-6xl mx-auto">
      <section>
        <h2 className="text-lg font-bold mb-2">1 · Source assets</h2>
        <FolderDrop onIngested={addAssets} />
        {assets.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold">{assets.length}</span>
              <span className="text-gray-600">assets loaded.</span>
              <button onClick={selectAll} className="text-primary-600 font-semibold">Select all</button>
              <button onClick={selectNone} className="text-gray-600">Clear selection</button>
              <span className="text-gray-400">·</span>
              <button onClick={clearAssets} className="text-red-600 inline-flex items-center gap-1">
                <Trash2 className="w-3 h-3" /> Remove all
              </button>
              <span className="ml-auto text-gray-500">
                {selectedAssetIds.size > 0
                  ? `Will reskin ${selectedAssetIds.size} selected`
                  : `Will reskin all ${assets.length}`}
              </span>
            </div>
            <AssetGrid
              assets={assets}
              selectedIds={selectedAssetIds}
              onToggle={toggleSelected}
              onRemove={removeAsset}
            />
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">2 · Theme prompt</h2>
        <div className="space-y-3">
          <textarea
            value={reskinSettings.prompt}
            onChange={(e) => setS({ prompt: e.target.value })}
            className="input-field min-h-[100px]"
            placeholder="e.g. Cozy autumn forest village, warm orange lighting, hand-painted brushstrokes, soft shadows, fantasy children's book style."
          />
          <textarea
            value={reskinSettings.negativePrompt}
            onChange={(e) => setS({ negativePrompt: e.target.value })}
            className="input-field min-h-[60px]"
            placeholder="Negative prompt (optional): low quality, watermark, photo, modern."
          />
          <StyleRefPicker
            refs={reskinSettings.styleRefs}
            onChange={(styleRefs) => setS({ styleRefs })}
          />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">3 · Engine</h2>
        <ProviderPicker
          capability="image"
          value={reskinSettings.providerId}
          onChange={(id) => {
            const models = IMAGE_MODELS[id];
            setS({ providerId: id, model: models[0] ?? '' });
          }}
          models={IMAGE_MODELS[reskinSettings.providerId] ?? []}
          model={reskinSettings.model}
          onModelChange={(m) => setS({ model: m })}
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          <div>
            <label className="text-xs font-semibold text-gray-700">Strength</label>
            <input
              type="number"
              step={0.05}
              min={0}
              max={1}
              value={reskinSettings.strength}
              onChange={(e) => setS({ strength: parseFloat(e.target.value) })}
              className="input-field mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700">Guidance</label>
            <input
              type="number"
              step={0.5}
              min={0}
              max={20}
              value={reskinSettings.guidance}
              onChange={(e) => setS({ guidance: parseFloat(e.target.value) })}
              className="input-field mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700">Steps</label>
            <input
              type="number"
              step={1}
              min={1}
              max={100}
              value={reskinSettings.steps}
              onChange={(e) => setS({ steps: parseInt(e.target.value, 10) })}
              className="input-field mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700">Seed</label>
            <input
              type="number"
              value={reskinSettings.seed ?? ''}
              onChange={(e) => setS({ seed: e.target.value ? parseInt(e.target.value, 10) : null })}
              className="input-field mt-1"
              placeholder="random"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 mt-3 text-sm">
          <input
            type="checkbox"
            checked={reskinSettings.preserveSize}
            onChange={(e) => setS({ preserveSize: e.target.checked })}
          />
          Preserve original dimensions (resize outputs back to source W×H)
        </label>
        <div className="mt-4">
          <LoRAManager
            loras={reskinSettings.loras}
            onChange={(loras) => setS({ loras })}
          />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">4 · Run</h2>
          {reskinResults.length > 0 && (
            <div className="flex gap-2">
              <button onClick={downloadAllReskins} className="btn-secondary inline-flex items-center gap-1">
                <Download className="w-4 h-4" /> Download ZIP
              </button>
              <button onClick={clearReskinResults} className="btn-danger inline-flex items-center gap-1">
                <Trash2 className="w-4 h-4" /> Clear results
              </button>
            </div>
          )}
        </div>
        <button
          onClick={runReskin}
          disabled={running}
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {running
            ? `Reskinning ${progress.done}/${progress.total}…`
            : `Reskin ${targetAssets.length} asset${targetAssets.length === 1 ? '' : 's'}`}
        </button>
        {error && (
          <div className="mt-3 flex items-center gap-2 text-red-700 bg-red-50 rounded-lg p-2 text-sm">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}
        {reskinResults.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="text-sm font-semibold text-gray-700">
              Results ({reskinResults.filter((r) => r.status === 'done').length}/
              {reskinResults.length} done)
            </div>
            <ReskinResultsGrid />
          </div>
        )}
      </section>
    </div>
  );
}

function ReskinResultsGrid() {
  const { reskinResults, assets, removeReskin } = useArt();
  const byId = new Map(assets.map((a) => [a.id, a]));
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {reskinResults.map((r) => {
        const source = byId.get(r.sourceId);
        return (
          <div key={r.id} className="card p-2 space-y-2">
            <div className="grid grid-cols-2 gap-1">
              <div className="aspect-square bg-gray-100 flex items-center justify-center rounded-md overflow-hidden">
                {source ? (
                  <img src={source.previewUrl} className="max-w-full max-h-full object-contain" alt="source" />
                ) : (
                  <span className="text-[10px] text-gray-400">src</span>
                )}
              </div>
              <div className="aspect-square bg-gray-100 flex items-center justify-center rounded-md overflow-hidden relative">
                {r.status === 'done' ? (
                  <img src={r.previewUrl} className="max-w-full max-h-full object-contain" alt="reskin" />
                ) : r.status === 'error' ? (
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                ) : (
                  <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                )}
              </div>
            </div>
            <div className="text-[11px] text-gray-700 truncate font-mono">{r.path}</div>
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-gray-500">
                {r.status === 'done' && (
                  <span className="inline-flex items-center gap-1 text-green-700">
                    <CheckCircle2 className="w-3 h-3" /> {r.width}×{r.height}
                  </span>
                )}
                {r.status === 'error' && (
                  <span className="text-red-600" title={r.error}>error</span>
                )}
                {r.status === 'running' && <span>running…</span>}
              </div>
              <button
                onClick={() => removeReskin(r.id)}
                className="text-[10px] text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
            {r.status === 'error' && r.error && (
              <div className="text-[10px] text-red-700 break-words">{r.error}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
