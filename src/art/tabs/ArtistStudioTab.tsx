import { useState } from 'react';
import { Play, Loader2, AlertTriangle, Trash2, Download } from 'lucide-react';
import { useArt } from '../store';
import ProviderPicker from '../components/ProviderPicker';
import StyleRefPicker from '../components/StyleRefPicker';
import LoRAManager from '../components/LoRAManager';
import { TEXT2IMAGE_MODELS } from '../providers/registry';
import { getTextToImageProvider } from '../providers';
import { putResult, getResult } from '../utils/storage';
import { newId } from '../utils/assets';
import { ArtistResult } from '../types';
import { downloadZip } from '../utils/zip';

const ASPECT_PRESETS: { label: string; w: number; h: number }[] = [
  { label: '1:1 · 1024', w: 1024, h: 1024 },
  { label: '4:3 · 1024', w: 1024, h: 768 },
  { label: '3:4 · 1024', w: 768, h: 1024 },
  { label: '16:9 · 1280', w: 1280, h: 720 },
  { label: '9:16 · 720', w: 720, h: 1280 },
  { label: '2:1 · 1536', w: 1536, h: 768 },
];

export default function ArtistStudioTab() {
  const {
    artistSettings,
    setArtistSettings,
    artistResults,
    upsertArtist,
    removeArtist,
    clearArtistResults,
    keys,
  } = useArt();

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const setS = (patch: Partial<typeof artistSettings>) =>
    setArtistSettings({ ...artistSettings, ...patch });

  async function runGenerate() {
    if (!artistSettings.prompt.trim()) {
      setError('Add a prompt describing what to create.');
      return;
    }
    setError(null);
    setRunning(true);
    setProgress({ done: 0, total: artistSettings.batchSize });

    const provider = getTextToImageProvider(artistSettings.providerId);
    for (let i = 0; i < artistSettings.batchSize; i++) {
      const result: ArtistResult = {
        id: newId(),
        prompt: artistSettings.prompt,
        previewUrl: '',
        width: artistSettings.width,
        height: artistSettings.height,
        status: 'running',
        providerId: artistSettings.providerId,
        model: artistSettings.model,
        createdAt: Date.now(),
      };
      upsertArtist(result);
      try {
        const output = await provider.generate(
          {
            prompt: artistSettings.prompt,
            negativePrompt: artistSettings.negativePrompt,
            guidance: artistSettings.guidance,
            steps: artistSettings.steps,
            seed:
              artistSettings.seed !== null
                ? artistSettings.seed + i
                : null,
            model: artistSettings.model,
            loras: artistSettings.loras.filter((l) => l.url.trim()),
            styleRefs: artistSettings.styleRefs,
            width: artistSettings.width,
            height: artistSettings.height,
          },
          keys
        );
        const r = await fetch(output.previewUrl);
        await putResult(result.id, await r.blob());
        upsertArtist({
          ...result,
          status: 'done',
          previewUrl: output.previewUrl,
          width: output.width,
          height: output.height,
        });
      } catch (err) {
        upsertArtist({
          ...result,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
      }
      setProgress({ done: i + 1, total: artistSettings.batchSize });
    }
    setRunning(false);
  }

  async function downloadAll() {
    const done = artistResults.filter((r) => r.status === 'done');
    const entries: { path: string; blob: Blob }[] = [];
    for (const r of done) {
      const blob = await getResult(r.id);
      if (blob) {
        const ts = new Date(r.createdAt).toISOString().replace(/[:.]/g, '-');
        entries.push({ path: `artist_${ts}_${r.id.slice(0, 6)}.png`, blob });
      }
    }
    await downloadZip('artist-studio.zip', entries);
  }

  return (
    <div className="space-y-6 p-4 max-w-6xl mx-auto">
      <section>
        <h2 className="text-lg font-bold mb-2">1 · What to create</h2>
        <textarea
          value={artistSettings.prompt}
          onChange={(e) => setS({ prompt: e.target.value })}
          className="input-field min-h-[120px]"
          placeholder="e.g. Stylized fantasy mushroom forest, glowing spores, soft volumetric lighting, painterly brushstrokes, vibrant teal and magenta palette."
        />
        <textarea
          value={artistSettings.negativePrompt}
          onChange={(e) => setS({ negativePrompt: e.target.value })}
          className="input-field min-h-[60px] mt-2"
          placeholder="Negative prompt (optional)."
        />
        <div className="mt-3">
          <StyleRefPicker
            refs={artistSettings.styleRefs}
            onChange={(styleRefs) => setS({ styleRefs })}
          />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">2 · Engine</h2>
        <ProviderPicker
          capability="image"
          value={artistSettings.providerId}
          onChange={(id) => {
            const models = TEXT2IMAGE_MODELS[id];
            setS({ providerId: id, model: models[0] ?? '' });
          }}
          models={TEXT2IMAGE_MODELS[artistSettings.providerId] ?? []}
          model={artistSettings.model}
          onModelChange={(m) => setS({ model: m })}
        />

        <div className="mt-3">
          <label className="text-xs font-semibold text-gray-700">Dimensions</label>
          <div className="flex flex-wrap gap-1 mt-1">
            {ASPECT_PRESETS.map((p) => {
              const active = p.w === artistSettings.width && p.h === artistSettings.height;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setS({ width: p.w, height: p.h })}
                  className={`px-2 py-1 rounded-md text-xs font-mono ${
                    active ? 'bg-primary-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <label className="text-[10px] font-semibold text-gray-600">Width</label>
              <input
                type="number"
                value={artistSettings.width}
                onChange={(e) => setS({ width: parseInt(e.target.value, 10) })}
                className="input-field mt-1"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-600">Height</label>
              <input
                type="number"
                value={artistSettings.height}
                onChange={(e) => setS({ height: parseInt(e.target.value, 10) })}
                className="input-field mt-1"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          <div>
            <label className="text-xs font-semibold text-gray-700">Guidance</label>
            <input
              type="number"
              step={0.5}
              value={artistSettings.guidance}
              onChange={(e) => setS({ guidance: parseFloat(e.target.value) })}
              className="input-field mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700">Steps</label>
            <input
              type="number"
              value={artistSettings.steps}
              onChange={(e) => setS({ steps: parseInt(e.target.value, 10) })}
              className="input-field mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700">Seed</label>
            <input
              type="number"
              value={artistSettings.seed ?? ''}
              onChange={(e) =>
                setS({ seed: e.target.value ? parseInt(e.target.value, 10) : null })
              }
              className="input-field mt-1"
              placeholder="random"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700">Batch size</label>
            <input
              type="number"
              min={1}
              max={20}
              value={artistSettings.batchSize}
              onChange={(e) => setS({ batchSize: parseInt(e.target.value, 10) })}
              className="input-field mt-1"
            />
          </div>
        </div>

        <div className="mt-4">
          <LoRAManager
            loras={artistSettings.loras}
            onChange={(loras) => setS({ loras })}
          />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">3 · Generate</h2>
          {artistResults.length > 0 && (
            <div className="flex gap-2">
              <button onClick={downloadAll} className="btn-secondary inline-flex items-center gap-1">
                <Download className="w-4 h-4" /> Download ZIP
              </button>
              <button onClick={clearArtistResults} className="btn-danger inline-flex items-center gap-1">
                <Trash2 className="w-4 h-4" /> Clear
              </button>
            </div>
          )}
        </div>
        <button
          onClick={runGenerate}
          disabled={running}
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {running
            ? `Generating ${progress.done}/${progress.total}…`
            : `Generate ${artistSettings.batchSize} image${artistSettings.batchSize === 1 ? '' : 's'}`}
        </button>
        {error && (
          <div className="mt-3 flex items-center gap-2 text-red-700 bg-red-50 rounded-lg p-2 text-sm">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}
        {artistResults.length > 0 && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {artistResults.map((r) => (
              <div key={r.id} className="card overflow-hidden">
                <div className="aspect-square bg-gray-100 flex items-center justify-center">
                  {r.status === 'done' ? (
                    <img src={r.previewUrl} className="max-w-full max-h-full object-contain" alt={r.prompt} />
                  ) : r.status === 'error' ? (
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                  ) : (
                    <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                  )}
                </div>
                <div className="p-2 space-y-1">
                  <div className="text-[10px] text-gray-500">
                    {r.width}×{r.height} · {r.model}
                  </div>
                  {r.status === 'error' && (
                    <div className="text-[10px] text-red-600 break-words">{r.error}</div>
                  )}
                  <div className="flex items-center justify-between">
                    {r.status === 'done' && (
                      <a
                        href={r.previewUrl}
                        download={`artist_${r.id.slice(0, 6)}.png`}
                        className="text-[10px] text-primary-600 inline-flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" /> Save
                      </a>
                    )}
                    <button
                      onClick={() => removeArtist(r.id)}
                      className="text-[10px] text-red-600 hover:underline ml-auto"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
