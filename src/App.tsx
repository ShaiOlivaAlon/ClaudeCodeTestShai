import { useEffect, useMemo, useRef, useState } from 'react';
import { Wand2, Loader2, AlertCircle, KeyRound } from 'lucide-react';
import type {
  Asset,
  Brief as BriefT,
  GeneratedImage,
  OutputSpec as SpecT,
  Suggestion,
} from './types';
import BrandKit from './components/BrandKit';
import Brief from './components/Brief';
import OutputSpec from './components/OutputSpec';
import Suggestions from './components/Suggestions';
import ResultsGrid from './components/ResultsGrid';
import Splash from './components/Splash';
import ApiKeyModal from './components/ApiKeyModal';
import { fetchSuggestions, generateImage, generateVideo } from './lib/api';
import { buildPrompt } from './lib/prompt';
import { getStoredKey, onKeyChange } from './lib/apiKey';

const initialBrief: BriefT = {
  theme: '',
  seasons: [],
  styles: [],
  features: [],
  titles: [],
  copyExamples: '',
  notes: '',
};

const initialSpec: SpecT = {
  aspects: ['1:1', '9:16', '16:9'],
  count: 1,
  imageModel: 'imagen-4',
  videoModel: 'veo-3',
};

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [hasKey, setHasKey] = useState(() => !!getStoredKey());
  const [keyModalOpen, setKeyModalOpen] = useState(false);

  useEffect(() => {
    return onKeyChange((k) => setHasKey(!!k));
  }, []);

  // Open the key modal as soon as the splash finishes, if no key is stored.
  useEffect(() => {
    if (!showSplash && !hasKey) setKeyModalOpen(true);
  }, [showSplash, hasKey]);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [brief, setBrief] = useState<BriefT>(initialBrief);
  const [spec, setSpec] = useState<SpecT>(initialSpec);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced suggestion refresh when brief changes meaningfully.
  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    const briefHasContent =
      brief.theme.trim() || brief.features.length || brief.styles.length || brief.seasons.length;
    if (!briefHasContent) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void refreshSuggestions();
    }, 1200);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief.theme, brief.features, brief.styles, brief.seasons, brief.notes]);

  async function refreshSuggestions() {
    setSuggestionsLoading(true);
    try {
      const sugg = await fetchSuggestions(brief, assets);
      setSuggestions(sugg);
    } catch (e) {
      console.warn(e);
    } finally {
      setSuggestionsLoading(false);
    }
  }

  const selectedSuggestions = useMemo(
    () => suggestions.filter((s) => selectedSuggestionIds.includes(s.id)),
    [suggestions, selectedSuggestionIds]
  );

  const totalToGenerate = spec.aspects.length * spec.count;

  async function handleGenerate() {
    setError(null);
    if (!brief.theme.trim() && !brief.features.length && !brief.styles.length) {
      setError('Add at least a theme, a style, or a use case to get focused output.');
      return;
    }
    if (!spec.aspects.length) {
      setError('Pick at least one aspect ratio.');
      return;
    }

    setGenerating(true);
    setPendingCount(totalToGenerate);

    const references = assets.map((a) => ({ kind: a.kind, dataUrl: a.dataUrl }));
    const titles = brief.titles.length ? brief.titles : [undefined];
    const newImages: GeneratedImage[] = [];

    try {
      for (let i = 0; i < spec.aspects.length; i++) {
        const aspect = spec.aspects[i];
        const title = titles[i % titles.length];
        const prompt = buildPrompt({
          brief,
          assets,
          selectedSuggestions,
          aspect,
          titleForThisImage: title,
        });
        const batch = await generateImage({
          prompt,
          aspect,
          model: spec.imageModel,
          count: spec.count,
          references,
        });
        newImages.push(...batch);
        setImages((prev) => [...batch, ...prev]);
        setPendingCount((p) => Math.max(0, p - batch.length));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
      setPendingCount(0);
    }
  }

  async function regenerate(id: string) {
    const target = images.find((i) => i.id === id);
    if (!target) return;
    setPendingCount((p) => p + 1);
    try {
      const references = assets.map((a) => ({ kind: a.kind, dataUrl: a.dataUrl }));
      const batch = await generateImage({
        prompt: target.prompt,
        aspect: target.aspect,
        model: spec.imageModel,
        count: 1,
        references,
      });
      if (batch[0]) {
        setImages((prev) => prev.map((img) => (img.id === id ? { ...batch[0], id } : img)));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPendingCount((p) => Math.max(0, p - 1));
    }
  }

  async function makeVideo(id: string) {
    const target = images.find((i) => i.id === id);
    if (!target) return;
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, videoLoading: true, videoError: undefined } : img))
    );
    try {
      const v = await generateVideo(
        {
          prompt: `Animate this marketing creative subtly: gentle camera move, sparkles and light play, looping 5 seconds. ${target.prompt.slice(0, 400)}`,
          imageDataUrl: target.dataUrl,
          model: spec.videoModel,
          filenameHint: target.aspect.replace(':', 'x'),
        },
        {
          onJobId: (jobId) =>
            setImages((prev) =>
              prev.map((img) => (img.id === id ? { ...img, videoJobId: jobId } : img))
            ),
        }
      );
      setImages((prev) =>
        prev.map((img) =>
          img.id === id
            ? {
                ...img,
                video: { url: v.url, model: v.model, sharepoint: v.sharepoint || undefined },
                videoLoading: false,
              }
            : img
        )
      );
    } catch (e) {
      setImages((prev) =>
        prev.map((img) =>
          img.id === id ? { ...img, videoLoading: false, videoError: (e as Error).message } : img
        )
      );
    }
  }

  return (
    <div className="min-h-screen">
      {showSplash && <Splash onDone={() => setShowSplash(false)} />}
      <ApiKeyModal
        open={keyModalOpen}
        canClose={hasKey}
        onClose={() => setKeyModalOpen(false)}
      />

      <header className="sticky top-0 z-30 backdrop-blur-md bg-ink-950/70 border-b border-white/5">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-accent-gradient shadow-glow flex items-center justify-center font-display font-bold text-white">
              P
            </div>
            <div>
              <div className="font-display text-base font-semibold text-white leading-tight">
                Playtika Art Studio
              </div>
              <div className="text-[11px] text-ink-400 -mt-0.5">
                Generate marketing creative from your IP
              </div>
            </div>
          </div>
          <button
            onClick={() => setKeyModalOpen(true)}
            className="flex items-center gap-2 text-xs text-ink-300 hover:text-white transition rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5"
            title={hasKey ? 'Change API key' : 'Add your API key'}
          >
            <span
              className={`inline-flex h-2 w-2 rounded-full ${hasKey ? 'bg-emerald-400' : 'bg-amber-400'}`}
            />
            <KeyRound size={12} />
            <span className="hidden sm:inline">
              {hasKey ? 'Gemini connected' : 'Add API key'}
            </span>
          </button>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="grid lg:grid-cols-[320px_1fr] gap-6">
          <BrandKit assets={assets} onChange={setAssets} />

          <div className="space-y-6">
            <Brief brief={brief} onChange={setBrief} />
            <OutputSpec spec={spec} onChange={setSpec} />
            <Suggestions
              suggestions={suggestions}
              selectedIds={selectedSuggestionIds}
              loading={suggestionsLoading}
              onToggle={(id) =>
                setSelectedSuggestionIds((cur) =>
                  cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
                )
              }
              onRefresh={() => void refreshSuggestions()}
            />

            <div className="sticky bottom-4 z-20">
              <div className="card-pad flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-ink-200">
                  Will generate <span className="font-semibold text-white">{totalToGenerate}</span>{' '}
                  image{totalToGenerate === 1 ? '' : 's'}
                  {selectedSuggestions.length > 0 && (
                    <> · <span className="text-accent-400">{selectedSuggestions.length} directions</span></>
                  )}
                  {assets.length > 0 && (
                    <> · <span className="text-electric-400">{assets.length} refs</span></>
                  )}
                </div>
                <button
                  className="btn-primary text-base"
                  onClick={handleGenerate}
                  disabled={generating}
                >
                  {generating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Generating…
                    </>
                  ) : (
                    <>
                      <Wand2 size={16} /> Generate
                    </>
                  )}
                </button>
              </div>
              {error && (
                <div className="mt-2 card-pad text-sm text-hot-400 flex items-center gap-2">
                  <AlertCircle size={14} /> {error}
                </div>
              )}
            </div>

            <ResultsGrid
              images={images}
              loadingCount={pendingCount}
              onRegenerate={regenerate}
              onMakeVideo={makeVideo}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
