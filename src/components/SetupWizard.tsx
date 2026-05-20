import { useState } from 'react';
import { KeyRound, Sparkles, Check, Copy } from 'lucide-react';
import type { ApiKeys, Provider, Role } from '../types';
import { useStore } from '../state/store';
import { saveSettings } from '../lib/storage';
import { Button, Modal, Select, TextInput, Field, Spinner } from './ui';
import { pingProvider } from '../lib/api';
import {
  IMAGE_MODELS, IMAGE_PROVIDERS, PROVIDER_LABEL, TEXT_MODELS, TEXT_PROVIDERS,
  VIDEO_MODELS, VIDEO_PROVIDERS, defaultModelFor,
} from '../lib/models';

interface RoleConfig {
  role: Role;
  label: string;
  hint: string;
  providers: Provider[];
  modelList: typeof TEXT_MODELS;
}

const ROLE_CONFIG: RoleConfig[] = [
  { role: 'text',  label: 'LLM (Text) API key',  hint: 'used for ideation & prompt enhancement', providers: TEXT_PROVIDERS,  modelList: TEXT_MODELS  },
  { role: 'image', label: 'Image API key',       hint: 'used to render images',                  providers: IMAGE_PROVIDERS, modelList: IMAGE_MODELS },
  { role: 'video', label: 'Video API key',       hint: 'used to animate to video',               providers: VIDEO_PROVIDERS, modelList: VIDEO_MODELS },
];

const DEFAULT_KEYS: ApiKeys = {
  text:  { provider: 'google', key: '' },
  image: { provider: 'google', key: '' },
  video: { provider: 'google', key: '' },
};

function placeholderFor(p: Provider): string {
  switch (p) {
    case 'google':    return 'AIza…';
    case 'anthropic': return 'sk-ant-…';
    case 'fal':       return 'fal-…';
    case 'openai':    return 'sk-…';
  }
}

export function SetupWizard() {
  const { state, dispatch } = useStore();
  const open = state.ui.setupOpen;

  const [keys, setKeys] = useState<ApiKeys>({
    text:  state.settings.apiKeys.text  ?? DEFAULT_KEYS.text,
    image: state.settings.apiKeys.image ?? DEFAULT_KEYS.image,
    video: state.settings.apiKeys.video ?? DEFAULT_KEYS.video,
  });
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<Partial<Record<Role, boolean>>>({});

  function setRole(role: Role, patch: { provider?: Provider; key?: string }) {
    setKeys((prev) => {
      const current = prev[role] ?? DEFAULT_KEYS[role]!;
      return { ...prev, [role]: { provider: patch.provider ?? current.provider, key: patch.key ?? current.key } };
    });
    setResults((r) => ({ ...r, [role]: undefined }));
  }

  function copyFromText(role: Role) {
    const src = keys.text;
    if (!src?.key) return;
    setRole(role, { provider: src.provider, key: src.key });
  }

  async function test() {
    setTesting(true);
    setResults({});
    const entries = (['text', 'image', 'video'] as Role[]).map(async (role) => {
      const r = keys[role];
      if (!r?.key) return [role, undefined] as const;
      const ok = await pingProvider(r.provider, r.key);
      return [role, ok] as const;
    });
    const settled = await Promise.all(entries);
    const next: Partial<Record<Role, boolean>> = {};
    for (const [role, ok] of settled) next[role] = ok;
    setResults(next);
    setTesting(false);
  }

  function save() {
    // Re-align default models to the chosen providers so the brief picks valid models.
    const textProv = keys.text?.provider ?? 'google';
    const imageProv = keys.image?.provider ?? 'google';
    const videoProv = keys.video?.provider ?? 'google';
    const next = {
      ...state.settings,
      apiKeys: {
        text:  keys.text?.key.trim()  ? { provider: textProv,  key: keys.text!.key.trim()  } : undefined,
        image: keys.image?.key.trim() ? { provider: imageProv, key: keys.image!.key.trim() } : undefined,
        video: keys.video?.key.trim() ? { provider: videoProv, key: keys.video!.key.trim() } : undefined,
      },
      defaultTextModel:  defaultModelFor(TEXT_MODELS,  textProv),
      defaultImageModel: defaultModelFor(IMAGE_MODELS, imageProv),
      defaultVideoModel: defaultModelFor(VIDEO_MODELS, videoProv),
      setupComplete: true,
    };
    saveSettings(next);
    dispatch({ type: 'settings/set', settings: next });
    dispatch({ type: 'brief/patch', patch: {
      textModel: next.defaultTextModel,
      imageModel: next.defaultImageModel,
      videoModel: next.defaultVideoModel,
    } });
    dispatch({ type: 'ui/openSetup', open: false });
    dispatch({ type: 'ui/toast', toast: { kind: 'success', message: 'Studio is ready. Drop in some characters to get started.' } });
  }

  const canSave = Boolean(
    keys.text?.key?.trim() && keys.image?.key?.trim() && keys.video?.key?.trim()
  );

  return (
    <Modal open={open} onClose={() => { /* required */ }} title="Welcome to Playtika Artist Studio">
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-lg border border-brand-400/30 bg-brand-500/10 p-3 text-sm text-brand-50">
          <Sparkles size={18} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Configure your model API keys</div>
            <div className="text-xs text-brand-100/80">
              Pick a provider per role and paste the matching key. If you have a single Google AI Studio key you can use it for all
              three — paste it in <strong>LLM (Text)</strong> first, then click the small copy buttons to mirror it into Image and
              Video. Keys stay in your browser only.
            </div>
          </div>
        </div>

        {ROLE_CONFIG.map(({ role, label, hint, providers }) => {
          const r = keys[role] ?? DEFAULT_KEYS[role]!;
          const showCopy = role !== 'text' && Boolean(keys.text?.key);
          return (
            <Field key={role} label={label} hint={hint}>
              <div className="flex items-center gap-2">
                <Select<Provider>
                  value={r.provider}
                  onChange={(p) => setRole(role, { provider: p })}
                  options={providers.map((p) => ({ value: p, label: PROVIDER_LABEL[p] }))}
                  className="!w-44 shrink-0"
                />
                <TextInput
                  type="password"
                  value={r.key}
                  onChange={(v) => setRole(role, { key: v })}
                  placeholder={placeholderFor(r.provider)}
                />
                {showCopy && (
                  <button
                    type="button"
                    onClick={() => copyFromText(role)}
                    title="Copy key from LLM (Text)"
                    className="shrink-0 rounded-md border border-ink-600 bg-ink-800 p-2 text-ink-200 hover:bg-ink-700 hover:text-white"
                  >
                    <Copy size={14} />
                  </button>
                )}
                <KeyResult ok={results[role]} />
              </div>
            </Field>
          );
        })}

        <div className="flex items-center justify-between border-t border-ink-700 pt-4">
          <Button variant="ghost" size="sm" onClick={test} disabled={testing || !canSave}>
            {testing ? <Spinner size={14} /> : <KeyRound size={14} />} Test keys
          </Button>
          <Button variant="primary" onClick={save} disabled={!canSave}>
            <Check size={16} /> Save & start
          </Button>
        </div>
        {!canSave && (
          <p className="text-xs text-ink-400">All three keys are required. They can be the same key if you're using one provider for everything.</p>
        )}
      </div>
    </Modal>
  );
}

function KeyResult({ ok }: { ok?: boolean }) {
  if (ok === undefined) return <span className="w-10" />;
  return ok ? (
    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-1 text-xs text-emerald-200">
      <Check size={12} /> OK
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-2 py-1 text-xs text-rose-200">
      ✕ Fail
    </span>
  );
}
