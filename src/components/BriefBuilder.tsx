import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, Square, Sparkles, Wand2, Image as ImageIcon, RefreshCw, Save, Trash2, Bookmark } from 'lucide-react';
import type { AspectRatio, Brief, BriefPreset, Suggestion } from '../types';
import { useStore } from '../state/store';
import {
  ASPECT_RATIOS, IMAGE_MODELS, PRESET_FEATURES, PRESET_STYLES, PRESET_THEMES,
  SEASONS, findModel,
} from '../lib/models';
import { useProviderModels, labelWithNew } from '../lib/googleModels';
import { AccordionCard, Button, Card, Chip, Field, SectionHeader, Select, Spinner, Textarea, TextInput, EmptyState, Toggle } from './ui';
import { TagCloud } from './TagCloud';
import { generateSuggestions, generateImage, makeAnimatePrompt, generateVideo } from '../lib/api';
import { putBriefPreset, deleteBriefPreset, putGeneration } from '../lib/storage';
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

  const apiKeys = state.settings.apiKeys;

  const textProv  = apiKeys.text?.provider  ?? 'google';
  const imageProv = apiKeys.image?.provider ?? 'google';
  const videoProv = apiKeys.video?.provider ?? 'google';
  const textModels  = useProviderModels('text',  textProv,  apiKeys.text?.key,  apiKeys.text?.endpoint);
  const imageModels = useProviderModels('image', imageProv, apiKeys.image?.key, apiKeys.image?.endpoint);
  const videoModels = useProviderModels('video', videoProv, apiKeys.video?.key, apiKeys.video?.endpoint);

  const imageModel = findModel(IMAGE_MODELS, brief.imageModel);
  const canUseRef = Boolean(imageModel?.supportsReference);

  useEffect(() => {
    const fixes: Partial<Brief> = {};
    if (!textModels.some((m) => m.id === brief.textModel)   && textModels[0])  fixes.textModel  = textModels[0].id;
    if (!imageModels.some((m) => m.id === brief.imageModel) && imageModels[0]) fixes.imageModel = imageModels[0].id;
    if (!videoModels.some((m) => m.id === brief.videoModel) && videoModels[0]) fixes.videoModel = videoModels[0].id;
    if (Object.keys(fixes).length) dispatch({ type: 'brief/patch', patch: fixes });
  }, [textModels, imageModels, videoModels, brief.textModel, brief.imageModel, brief.videoModel, dispatch]);

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
    if (!apiKeys.text?.key) {
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: 'Add your LLM (Text) API key in Settings first.' } });
      dispatch({ type: 'ui/openSettings', open: true });
      return;
    }
    const missing = describeMissing();
    if (missing) {
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: missing } });
      return;
    }
    dispatch({ type: 'ui/suggesting', value: true });
    try {
      const suggestions = await generateSuggestions({
        apiKeys,
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
    if (!apiKeys.image?.key) {
      dispatch({ type: 'ui/toast', toast: { kind: 'error', message: 'Add your Image API key in Settings first.' } });
      dispatch({ type: 'ui/openSettings', open: true });
      return;
    }
    const ratios: AspectRatio[] = brief.aspectRatios.length ? brief.aspectRatios : ['1:1'];

    dispatch({ type: 'ui/generating', value: true });

    let referenceDataUrls: string[] = [];
    if (canUseRef) {
      const refs = [...characters, ...references, ...items, ...logos].slice(0, 3);
      referenceDataUrls = refs.map((a) => a.dataUrl);
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
            projectId: state.activeProjectId ?? undefined,
            chosenSeason: sug.chosenSeason,
            chosenTheme:  sug.chosenTheme,
            chosenStyle:  sug.chosenStyle,
          };
          dispatch({ type: 'generations/upsert', generation: gen });
          try {
            const { url, cached } = await generateImage({
              apiKeys,
              model: brief.imageModel,
              prompt: sug.prompt,
              aspectRatio: ratio,
              referenceDataUrls,
              cacheRefs: { referenceAssetIds: includedAssets.map((a) => a.id), assets: state.assets },
            });
            if (cached) {
              dispatch({ type: 'ui/toast', toast: { kind: 'info', message: `Reused cached render for "${sug.title}" (${ratio}) — no API spend.` } });
            }
            const completed = { ...gen, imageUrl: url, status: 'done' as const };
            dispatch({ type: 'generations/upsert', generation: completed });
            putGeneration(completed);

            if (animateOnGenerate && apiKeys.video?.key) {
              const animPrompt = makeAnimatePrompt({ title: sug.title, description: sug.description, prompt: sug.prompt });
              const withVideoQueued = { ...completed, video: { status: 'generating' as const, model: brief.videoModel, prompt: animPrompt } };
              dispatch({ type: 'generations/upsert', generation: withVideoQueued });
              try {
                const { url: videoUrl } = await generateVideo({
                  apiKeys,
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

  // What's "enough" to brainstorm: an aspect ratio + at least one signal of intent.
  // The free-text prompt or any selected assets count as a signal.
  function describeMissing(): string | null {
    const missing: string[] = [];
    if (brief.aspectRatios.length === 0) missing.push('at least one aspect ratio');
    const anySignal = (brief.mainPrompt?.trim() ? 1 : 0)
      + brief.themes.length + brief.styles.length + brief.features.length
      + brief.seasons.length + brief.titles.length + brief.notes.length + includedAssets.length;
    if (anySignal === 0) missing.push('a prompt, theme, style, asset, or some notes');
    return missing.length === 0 ? null : `Add ${missing.join(' and ')} before brainstorming.`;
  }
  const missingMessage = describeMissing();

  // Summaries shown in the collapsed accordion headers.
  const moodSummary = useMemo(() => {
    const parts: string[] = [];
    if (brief.seasons.length) parts.push(`${brief.seasons.length} season${brief.seasons.length > 1 ? 's' : ''}`);
    if (brief.themes.length)  parts.push(`${brief.themes.length} theme${brief.themes.length > 1 ? 's' : ''}`);
    if (brief.styles.length)  parts.push(`${brief.styles.length} style${brief.styles.length > 1 ? 's' : ''}`);
    if (brief.features.length) parts.push(`${brief.features.length} FX`);
    return parts.length ? parts.join(' · ') : 'nothing selected';
  }, [brief]);

  const copySummary = useMemo(() => {
    const parts: string[] = [];
    if (brief.titles.length) parts.push(`${brief.titles.length} title${brief.titles.length > 1 ? 's' : ''}`);
    if (brief.textExamples.length) parts.push(`${brief.textExamples.length} copy example${brief.textExamples.length > 1 ? 's' : ''}`);
    if (brief.notes.trim()) parts.push('notes');
    return parts.length ? parts.join(' · ') : 'no copy set';
  }, [brief]);

  const modelsSummary = `ideation: ${findModel(textModels as any, brief.textModel)?.name ?? brief.textModel} · image: ${findModel(imageModels as any, brief.imageModel)?.name ?? brief.imageModel} · ${brief.variationCount} ideas`;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-ink-800 px-3 py-2 sm:px-5 sm:py-3">
        <div className="min-w-0">
          <div className="font-display text-sm font-semibold uppercase tracking-wider text-ink-100">Brief</div>
          <div className="truncate text-xs text-ink-400">Configure once, generate dozens of variations.</div>
        </div>
        <div className="hidden shrink-0 items-center gap-2 text-xs text-ink-300 sm:flex">
          <span>{includedAssets.length} assets</span>·<span>{brief.aspectRatios.length} ratios</span>·<span>{brief.titles.length} titles</span>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
        <PresetsBar />

        <Card>
          <SectionHeader
            title="Prompt"
            subtitle="Free-text creative direction — passed to the model as the highest-priority instruction."
            action={brief.mainPrompt.trim().length > 0 ? (
              <span className="text-[10px] text-ink-400">{brief.mainPrompt.trim().length} chars</span>
            ) : null}
          />
          <Textarea
            value={brief.mainPrompt}
            onChange={(v) => patch({ mainPrompt: v })}
            rows={3}
            placeholder='e.g. "A series of magical Shavuot ad creatives for a Match-3 game — Shai, Alon, and baby Oliva in a sun-drenched meadow surrounded by glowing wheat and golden coins. Cozy 3D cartoon, warm light, sparkles. Title: KALUA ASHDOD."'
          />
        </Card>

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
                      <div key={a.id} className="group relative" title={a.description || a.name}>
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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
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

        <AccordionCard
          title="Mood, theme & style"
          subtitle="Each idea picks one season + one theme + one style from these lists."
          summary={moodSummary}
        >
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
            <Field label="Required features / FX (combined freely per image)">
              <TagCloud
                selected={brief.features}
                presets={PRESET_FEATURES}
                onToggle={(v) => dispatch({ type: 'brief/toggleTag', field: 'features', value: v })}
                placeholder="e.g. gold dust trail"
              />
            </Field>
          </div>
        </AccordionCard>

        <AccordionCard
          title="Copy & must-appear titles"
          subtitle="Titles are requested verbatim on the image."
          summary={copySummary}
        >
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
        </AccordionCard>

        <AccordionCard
          title="Models & count"
          subtitle="Per-batch overrides; defaults come from Settings."
          summary={modelsSummary}
        >
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Ideation model">
              <Select value={brief.textModel} onChange={(v) => patch({ textModel: v })}
                options={textModels.map((m) => ({ value: m.id, label: labelWithNew(m.name, m.isNew) }))} />
            </Field>
            <Field label="Image model">
              <Select value={brief.imageModel} onChange={(v) => patch({ imageModel: v })}
                options={imageModels.map((m) => ({ value: m.id, label: labelWithNew(m.name, m.isNew) }))} />
            </Field>
            <Field label="Video model">
              <Select value={brief.videoModel} onChange={(v) => patch({ videoModel: v })}
                options={videoModels.map((m) => ({ value: m.id, label: labelWithNew(m.name, m.isNew) }))} />
            </Field>
            <Field label={`Ideas to brainstorm: ${brief.variationCount}`}>
              <input
                type="range" min={3} max={24} step={1} value={brief.variationCount}
                onChange={(e) => patch({ variationCount: Number(e.target.value) })}
                className="w-full accent-brand-500"
              />
            </Field>
            <div className="md:col-span-2 flex items-end justify-end">
              <Toggle checked={animateOnGenerate} onChange={setAnimateOnGenerate} label="Auto-animate to video" />
            </div>
          </div>
          {!canUseRef && characters.length > 0 && (
            <p className="mt-3 text-xs text-amber-300">
              Heads up: <strong>{imageModel?.name}</strong> doesn't accept character references — switch to
              <em> FLUX + Character</em> or <em>GPT Image 1</em> to lock identity.
            </p>
          )}
        </AccordionCard>

        <Card className="border-brand-400/40 bg-brand-500/5">
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-display text-base font-semibold text-white">
                <Sparkles size={18} className="text-brand-300" /> Brainstorm concept set
              </div>
              <div className="text-xs text-ink-300">Each idea picks one season + theme + style — clearly labelled on the result.</div>
              {missingMessage && (
                <div className="mt-1 text-[11px] text-amber-300">{missingMessage}</div>
              )}
            </div>
            <Button size="lg" onClick={onGenerateSuggestions} disabled={state.ui.suggesting}>
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

function PresetsBar() {
  const { state, dispatch } = useStore();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  async function save() {
    const n = name.trim();
    if (!n) return;
    const { selectedAssetIds: _omit, ...rest } = state.brief;
    void _omit;
    const preset: BriefPreset = {
      id: uid('preset'),
      name: n,
      brief: rest,
      createdAt: Date.now(),
    };
    await putBriefPreset(preset);
    dispatch({ type: 'briefPresets/upsert', preset });
    dispatch({ type: 'ui/toast', toast: { kind: 'success', message: `Saved preset "${n}".` } });
    setNaming(false);
    setName('');
  }

  function load(id: string) {
    if (!id) return;
    const p = state.briefPresets.find((x) => x.id === id);
    if (!p) return;
    dispatch({ type: 'brief/patch', patch: p.brief });
    dispatch({ type: 'ui/toast', toast: { kind: 'info', message: `Loaded preset "${p.name}".` } });
  }

  async function remove(id: string) {
    const p = state.briefPresets.find((x) => x.id === id);
    if (!p) return;
    if (!confirm(`Delete preset "${p.name}"?`)) return;
    await deleteBriefPreset(id);
    dispatch({ type: 'briefPresets/remove', id });
  }

  return (
    <Card padding={false}>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-200">
          <Bookmark size={14} className="text-brand-300" /> Presets
        </div>
        {state.briefPresets.length > 0 ? (
          <div className="flex flex-1 flex-wrap items-center gap-1.5">
            {state.briefPresets.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1 rounded-full border border-ink-600 bg-ink-800/60 pl-2.5 text-xs text-ink-200">
                <button onClick={() => load(p.id)} className="py-1 hover:text-white" title="Load this preset">
                  {p.name}
                </button>
                <button
                  onClick={() => remove(p.id)}
                  className="rounded-r-full px-1.5 py-1 text-ink-400 hover:text-rose-300"
                  title="Delete preset"
                >
                  <Trash2 size={11} />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <span className="flex-1 text-xs text-ink-400">No saved presets yet. Save the current brief to reuse it later.</span>
        )}
        {naming ? (
          <>
            <TextInput
              value={name}
              onChange={setName}
              placeholder="preset name…"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } if (e.key === 'Escape') { setNaming(false); setName(''); } }}
              className="max-w-[180px] py-1 text-xs"
            />
            <Button size="sm" onClick={save}><Save size={12} /> Save</Button>
            <Button size="sm" variant="ghost" onClick={() => { setNaming(false); setName(''); }}>Cancel</Button>
          </>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setNaming(true)}>
            <Save size={12} /> Save current
          </Button>
        )}
      </div>
    </Card>
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
          <div className="flex flex-wrap items-center gap-2">
            <div className="truncate font-semibold text-white">{suggestion.title}</div>
            {suggestion.chosenSeason && <AxisPill kind="season" value={suggestion.chosenSeason} />}
            {suggestion.chosenTheme  && <AxisPill kind="theme"  value={suggestion.chosenTheme} />}
            {suggestion.chosenStyle  && <AxisPill kind="style"  value={suggestion.chosenStyle} />}
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

function AxisPill({ kind, value }: { kind: 'season' | 'theme' | 'style'; value: string }) {
  const tone = kind === 'season'
    ? 'border-amber-400/50 bg-amber-500/10 text-amber-100'
    : kind === 'theme'
      ? 'border-brand-400/50 bg-brand-500/10 text-brand-100'
      : 'border-emerald-400/50 bg-emerald-500/10 text-emerald-100';
  return (
    <span className={cls('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium', tone)}>
      {value}
    </span>
  );
}
