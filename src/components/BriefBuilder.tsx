import { useMemo, useState } from 'react';
import { CheckSquare, Square, Sparkles, Wand2, Image as ImageIcon, Cog, RefreshCw } from 'lucide-react';
import type { AspectRatio, Brief, Suggestion } from '../types';
import { useStore } from '../state/store';
import {
  ASPECT_RATIOS, IMAGE_MODELS, PRESET_FEATURES, PRESET_STYLES, PRESET_THEMES,
  SEASONS, TEXT_MODELS, VIDEO_MODELS, findModel,
} from '../lib/models';
import { Button, Card, Chip, Field, SectionHeader, Select, Spinner, Textarea, TextInput, EmptyState, Toggle } from './ui';
import { TagCloud } from './TagCloud';
import { generateSuggestions, generateImage, falUpload, makeAnimatePrompt, generateVideo } from '../lib/api';
import { putGeneration } from '../lib/storage';
import { cls, uid } from '../lib/utils';

export function BriefBuilder() {
  const { state, dispatch } = useStore();
  const brief = state.brief;
  const includedAssets = state.assets.filter((a) => brief.selectedAssetIds.includes(a.id));
  const characters = includedAssets.filter((a) => a.category === 'character');
  const items     = includedAssets.filter((a) => a.category === 'item');
  const logos     = includedAssets.filter((a) => a.category === 'logo');
  const references = includedAssets.filter((a) => a.category === 'reference');

  const [titleDraft, setTitleDraft] = useState('');
  const [copyDraft, setCopyDraft] = useState('');
  const [animateOnGenerate, setAnimateOnGenerate] = useState(false);

  const patch = (p: Partial<Brief>) => dispatch({ type: 'brief/patch', patch: p });

  const imageModel = findModel(IMAGE_MODELS, brief.imageModel);
  const canUseRef = Boolean(imageModel?.supportsReference);

  const apiKeys = state.settings.apiKeys;

  function addTitle() {
    const v = titleDraft.trim();
    if (!v) return;
    dispatch({ type: 'brief/setList', field: 'titles', values: [...brief.titles, v] });
    setTitleDraft('');
  }
  function addCopy() {
    const v = copyDraft.trim();
    if (!v) return;
    dispatch({ type: 'brief/setList', field: 'textExamples', values: [...brief.textExamples, v] });
    setCopyDraft('');
  }

  async function onGenerateSuggestions() {
    if (!apiKeys.anthropic) {
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: 'Add your Anthropic API key in Settings first.' } });
      dispatch({ type: 'ui/openSettings', open: true });
      return;
    }
    dispatch({ type: 'ui/suggesting', value: true });
    try {
      const suggestions = await generateSuggestions({
        apiKey: apiKeys.anthropic,
        textModel: brief.textModel,
        brief: {
          brief,
          characters: state.assets.filter((a) => brief.selectedAssetIds.includes(a.id) && a.category === 'character'),
          items:      state.assets.filter((a) => brief.selectedAssetIds.includes(a.id) && a.category === 'item'),
          logos:      state.assets.filter((a) => brief.selectedAssetIds.includes(a.id) && a.category === 'logo'),
          references: state.assets.filter((a) => brief.selectedAssetIds.includes(a.id) && a.category === 'reference'),
        },
      });
      dispatch({ type: 'suggestions/set', suggestions });
      dispatch({ type: 'ui/toast', toast: { kind: 'success', message: `Generated ${suggestions.length} ideas — tick the ones you want to render.` } });
    } catch (err: any) {
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: err?.message ?? 'Ideation failed.' } });
    } finally {
      dispatch({ type: 'ui/suggesting', value: false });
    }
  }

  async function onGenerateImages() {
    const chosen = state.suggestions.filter((s) => s.selected);
    if (!chosen.length) {
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: 'Pick at least one idea first.' } });
      return;
    }
    if (!apiKeys.fal) {
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: 'Add your fal.ai API key in Settings first.' } });
      dispatch({ type: 'ui/openSettings', open: true });
      return;
    }
    const ratios: AspectRatio[] = brief.aspectRatios.length ? brief.aspectRatios : ['1:1'];

    dispatch({ type: 'ui/generating', value: true });

    // Upload reference images once and reuse URLs for all generations.
    let referenceUrls: string[] = [];
    if (canUseRef) {
      const refs = [...characters, ...references, ...items, ...logos].slice(0, 3);
      try {
        referenceUrls = await Promise.all(refs.map((a) => falUpload(a.dataUrl, apiKeys.fal!, `${a.name}.png`)));
      } catch (err: any) {
        dispatch({ type: 'ui/toast', toast: { kind: 'error', message: `Could not upload reference: ${err?.message ?? err}` } });
      }
    }

    const totalJobs = chosen.length * ratios.length;
    let done = 0;

    await Promise.all(
      chosen.flatMap((sug) =>
        ratios.map(async (ratio) => {
          const id = uid('gen');
          const gen = {
            id,
            suggestionId: sug.id,
            title: sug.title,
            prompt: sug.prompt,
            enhancedPrompt: sug.prompt,
            aspectRatio: ratio,
            imageModel: brief.imageModel,
            status: 'generating' as const,
            createdAt: Date.now(),
            referenceAssetIds: includedAssets.map((a) => a.id),
          };
          dispatch({ type: 'generations/upsert', generation: gen });
          try {
            const { url } = await generateImage({
              apiKey: apiKeys.fal!,
              model: brief.imageModel,
              prompt: sug.prompt,
              aspectRatio: ratio,
              referenceUrls,
            });
            const completed = { ...gen, imageUrl: url, status: 'done' as const };
            dispatch({ type: 'generations/upsert', generation: completed });
            putGeneration(completed);

            // Optionally chain video generation.
            if (animateOnGenerate && apiKeys.fal) {
              const animPrompt = makeAnimatePrompt({ title: sug.title, description: sug.description, prompt: sug.prompt });
              const withVideoQueued = { ...completed, video: { status: 'generating' as const, model: brief.videoModel, prompt: animPrompt } };
              dispatch({ type: 'generations/upsert', generation: withVideoQueued });
              try {
                const { url: videoUrl } = await generateVideo({
                  apiKey: apiKeys.fal,
                  model: brief.videoModel,
                  prompt: animPrompt,
                  imageUrl: url,
                  aspectRatio: ratio,
                });
                const final = { ...withVideoQueued, video: { ...withVideoQueued.video!, status: 'done' as const, url: videoUrl } };
                dispatch({ type: 'generations/upsert', generation: final });
                putGeneration(final);
              } catch (vErr: any) {
                const failed = { ...withVideoQueued, video: { ...withVideoQueued.video!, status: 'error' as const, error: vErr?.message ?? 'video failed' } };
                dispatch({ type: 'generations/upsert', generation: failed });
                putGeneration(failed);
              }
            }
          } catch (err: any) {
            const failed = { ...gen, status: 'error' as const, error: err?.message ?? 'generation failed' };
            dispatch({ type: 'generations/upsert', generation: failed });
            putGeneration(failed);
          } finally {
            done++;
            if (done === totalJobs) {
              dispatch({ type: 'ui/generating', value: false });
              dispatch({ type: 'ui/toast', toast: { kind: 'success', message: `Generated ${totalJobs} images.` } });
            }
          }
        })
      )
    );
  }

  const briefReady = useMemo(() => brief.aspectRatios.length > 0 && (brief.themes.length + brief.styles.length + brief.features.length + brief.titles.length + brief.notes.length > 0), [brief]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink-800 px-5 py-3">
        <div>
          <div className="font-display text-sm font-semibold uppercase tracking-wider text-ink-100">Brief</div>
          <div className="text-xs text-ink-400">Configure once, generate dozens of variations.</div>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-300">
          <span>{includedAssets.length} assets</span>·<span>{brief.aspectRatios.length} ratios</span>·<span>{brief.titles.length} titles</span>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <Card>
          <SectionHeader title="Included from library" subtitle="Click thumbnails on the left to add or remove."
            action={includedAssets.length > 0 && (
              <button onClick={() => includedAssets.forEach((a) => dispatch({ type: 'brief/toggleAsset', assetId: a.id }))}
                className="text-xs text-ink-300 hover:text-white">clear all</button>
            )}
          />
          {includedAssets.length === 0 ? (
            <EmptyState icon={<ImageIcon size={22} />} title="No assets selected" hint="Upload and select characters, items, or a logo to drive the generation." />
          ) : (
            <div className="space-y-3">
              {[
                { label: 'Characters', list: characters },
                { label: 'Items', list: items },
                { label: 'Logos', list: logos },
                { label: 'References', list: references },
              ].filter((g) => g.list.length).map((group) => (
                <div key={group.label}>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400">{group.label}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.list.map((a) => (
                      <div key={a.id} className="group relative">
                        <img src={a.dataUrl} alt={a.name} className="h-12 w-12 rounded-md border border-ink-700 object-cover" />
                        <button
                          onClick={() => dispatch({ type: 'brief/toggleAsset', assetId: a.id })}
                          className="absolute -right-1 -top-1 hidden rounded-full bg-ink-700 p-0.5 text-ink-100 group-hover:block"
                          title="Remove from brief">×</button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <SectionHeader title="Aspect ratios" subtitle="Each ticked ratio multiplies your output set." />
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {ASPECT_RATIOS.map((r) => {
              const active = brief.aspectRatios.includes(r.id);
              return (
                <button
                  key={r.id}
                  onClick={() => dispatch({ type: 'brief/toggleAspect', ratio: r.id })}
                  className={cls(
                    'group flex flex-col items-center rounded-lg border p-2 text-xs transition',
                    active ? 'border-brand-400 bg-brand-500/10 text-white shadow-glow' : 'border-ink-700 text-ink-300 hover:border-ink-500 hover:text-white'
                  )}
                  title={r.use}
                >
                  <div className="flex h-10 items-center justify-center">
                    <div
                      className={cls('rounded-sm border', active ? 'border-brand-300 bg-brand-500/30' : 'border-ink-500 bg-ink-800')}
                      style={{ width: 24 * (r.w / Math.max(r.w, r.h)), height: 24 * (r.h / Math.max(r.w, r.h)) }}
                    />
                  </div>
                  <span className="font-semibold">{r.label}</span>
                  <span className="text-[10px] text-ink-400">{r.use.split(' — ')[0]}</span>
                </button>
              );
            })}
          </div>
        </Card>

        <Card>
          <SectionHeader title="Mood, theme & style" subtitle="Mix presets and add your own." />
          <div className="space-y-4">
            <Field label="Seasonal / period">
              <TagCloud
                selected={brief.seasons}
                presets={SEASONS}
                onToggle={(v) => dispatch({ type: 'brief/toggleTag', field: 'seasons', value: v })}
                placeholder="e.g. Cyber Monday"
              />
            </Field>
            <Field label="Themes">
              <TagCloud
                selected={brief.themes}
                presets={PRESET_THEMES}
                onToggle={(v) => dispatch({ type: 'brief/toggleTag', field: 'themes', value: v })}
                placeholder="e.g. Pirate cove"
              />
            </Field>
            <Field label="Visual styles">
              <TagCloud
                selected={brief.styles}
                presets={PRESET_STYLES}
                onToggle={(v) => dispatch({ type: 'brief/toggleTag', field: 'styles', value: v })}
                placeholder="e.g. matte painting"
              />
            </Field>
            <Field label="Required features / FX">
              <TagCloud
                selected={brief.features}
                presets={PRESET_FEATURES}
                onToggle={(v) => dispatch({ type: 'brief/toggleTag', field: 'features', value: v })}
                placeholder="e.g. gold dust trail"
              />
            </Field>
          </div>
        </Card>

        <Card>
          <SectionHeader title="Copy & must-appear titles" subtitle="Titles will be requested verbatim on the image." />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Title text (rendered on image)">
              <div className="flex items-center gap-2">
                <TextInput value={titleDraft} onChange={setTitleDraft} placeholder='e.g. "MEGA BONUS"'
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTitle(); } }} />
                <Button size="sm" variant="secondary" onClick={addTitle}>Add</Button>
              </div>
              {brief.titles.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {brief.titles.map((t) => (
                    <Chip key={t} active onRemove={() =>
                      dispatch({ type: 'brief/setList', field: 'titles', values: brief.titles.filter((x) => x !== t) })
                    }>{t}</Chip>
                  ))}
                </div>
              )}
            </Field>
            <Field label="Tone / copy examples (not rendered)">
              <div className="flex items-center gap-2">
                <TextInput value={copyDraft} onChange={setCopyDraft} placeholder='e.g. "Spin to win — limited time!"'
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCopy(); } }} />
                <Button size="sm" variant="secondary" onClick={addCopy}>Add</Button>
              </div>
              {brief.textExamples.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {brief.textExamples.map((t) => (
                    <Chip key={t} active onRemove={() =>
                      dispatch({ type: 'brief/setList', field: 'textExamples', values: brief.textExamples.filter((x) => x !== t) })
                    }>{t}</Chip>
                  ))}
                </div>
              )}
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Additional notes (free-form)">
              <Textarea value={brief.notes} onChange={(v) => patch({ notes: v })} rows={2}
                placeholder="anything else — campaign goal, audience, do's and don'ts…" />
            </Field>
          </div>
        </Card>

        <Card>
          <SectionHeader title="Models & count" subtitle="Per-batch overrides; defaults come from Settings." />
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Ideation model">
              <Select value={brief.textModel} onChange={(v) => patch({ textModel: v })}
                options={TEXT_MODELS.map((m) => ({ value: m.id, label: m.name }))} />
            </Field>
            <Field label="Image model">
              <Select value={brief.imageModel} onChange={(v) => patch({ imageModel: v })}
                options={IMAGE_MODELS.map((m) => ({ value: m.id, label: m.name }))} />
            </Field>
            <Field label="Video model">
              <Select value={brief.videoModel} onChange={(v) => patch({ videoModel: v })}
                options={VIDEO_MODELS.map((m) => ({ value: m.id, label: m.name }))} />
            </Field>
            <Field label={`Ideas to brainstorm: ${brief.variationCount}`}>
              <input
                type="range" min={3} max={24} step={1} value={brief.variationCount}
                onChange={(e) => patch({ variationCount: Number(e.target.value) })}
                className="w-full accent-brand-500"
              />
            </Field>
            <div className="md:col-span-2 flex items-end justify-end">
              <div className="flex items-center gap-3 text-xs text-ink-300">
                <Toggle checked={animateOnGenerate} onChange={setAnimateOnGenerate} label="Auto-animate to video" />
                <Cog size={14} className="text-ink-400" />
              </div>
            </div>
          </div>
          {!canUseRef && characters.length > 0 && (
            <p className="mt-3 text-xs text-amber-300">
              Heads up: <strong>{imageModel?.name}</strong> doesn't accept character references — switch to
              <em> FLUX + Character</em> or <em>GPT Image 1</em> to lock identity.
            </p>
          )}
        </Card>

        <Card className="border-brand-400/40 bg-brand-500/5">
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 font-display text-base font-semibold text-white">
                <Sparkles size={18} className="text-brand-300" /> Brainstorm concept set
              </div>
              <div className="text-xs text-ink-300">Claude turns your brief into a multi-choice list of ideas.</div>
            </div>
            <Button size="lg" onClick={onGenerateSuggestions} disabled={state.ui.suggesting || !briefReady} title={!briefReady ? 'Fill at least an aspect ratio plus a theme/style/title.' : ''}>
              {state.ui.suggesting ? <Spinner size={16} /> : <Wand2 size={16} />}
              {state.ui.suggesting ? 'Brainstorming…' : 'Generate ideas'}
            </Button>
          </div>
        </Card>

        {state.suggestions.length > 0 && <SuggestionPanel onGenerate={onGenerateImages} generating={state.ui.generating} />}
      </div>
    </div>
  );
}

function SuggestionPanel({ onGenerate, generating }: { onGenerate: () => void; generating: boolean }) {
  const { state, dispatch } = useStore();
  const selectedCount = state.suggestions.filter((s) => s.selected).length;
  const ratios = state.brief.aspectRatios.length || 1;

  return (
    <Card>
      <SectionHeader
        title="Concept ideas"
        subtitle={`${selectedCount} selected × ${ratios} ratios = ${selectedCount * ratios} images`}
        action={
          <div className="flex gap-2 text-xs text-ink-300">
            <button onClick={() => dispatch({ type: 'suggestions/selectAll', selected: true })} className="hover:text-white">select all</button>
            <span>·</span>
            <button onClick={() => dispatch({ type: 'suggestions/selectAll', selected: false })} className="hover:text-white">deselect</button>
            <span>·</span>
            <button onClick={() => dispatch({ type: 'suggestions/clear' })} className="inline-flex items-center gap-1 hover:text-white"><RefreshCw size={11} /> reset</button>
          </div>
        }
      />
      <ul className="space-y-2">
        {state.suggestions.map((s) => <SuggestionRow key={s.id} suggestion={s} />)}
      </ul>
      <div className="mt-4 flex items-center justify-between border-t border-ink-700 pt-4">
        <div className="text-xs text-ink-400">Generated images appear in the gallery on the right.</div>
        <Button size="lg" onClick={onGenerate} disabled={generating || selectedCount === 0}>
          {generating ? <Spinner size={16} /> : <ImageIcon size={16} />}
          {generating ? 'Rendering…' : `Generate ${selectedCount * ratios} images`}
        </Button>
      </div>
    </Card>
  );
}

function SuggestionRow({ suggestion }: { suggestion: Suggestion }) {
  const { dispatch } = useStore();
  const [open, setOpen] = useState(false);
  return (
    <li className={cls(
      'rounded-lg border p-3 transition',
      suggestion.selected ? 'border-brand-400/60 bg-brand-500/10' : 'border-ink-700 bg-ink-850 hover:border-ink-500'
    )}>
      <div className="flex items-start gap-3">
        <button onClick={() => dispatch({ type: 'suggestions/toggle', id: suggestion.id })} className="mt-0.5 text-brand-300">
          {suggestion.selected ? <CheckSquare size={18} /> : <Square size={18} className="text-ink-400" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate font-semibold text-white">{suggestion.title}</div>
            {suggestion.tags.map((t) => (
              <span key={t} className="rounded-full bg-ink-700 px-2 py-0.5 text-[10px] text-ink-200">{t}</span>
            ))}
          </div>
          <p className="mt-0.5 text-xs text-ink-300">{suggestion.description}</p>
          {open ? (
            <p className="mt-2 whitespace-pre-wrap rounded-md border border-ink-700 bg-ink-900 p-2 text-[11px] text-ink-200">{suggestion.prompt}</p>
          ) : null}
          <button onClick={() => setOpen((o) => !o)} className="mt-1 text-[11px] text-ink-400 hover:text-white">
            {open ? 'hide prompt' : 'view prompt'}
          </button>
        </div>
      </div>
    </li>
  );
}
