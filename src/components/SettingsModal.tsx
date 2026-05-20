import { useState } from 'react';
import { Check, KeyRound, Trash2, Copy } from 'lucide-react';
import type { ApiKeys, Provider, Role } from '../types';
import { useStore } from '../state/store';
import { saveSettings } from '../lib/storage';
import { Button, Field, Modal, Select, Spinner, TextInput } from './ui';
import {
  IMAGE_MODELS, IMAGE_PROVIDERS, PROVIDER_LABEL, TEXT_MODELS, TEXT_PROVIDERS,
  VIDEO_MODELS, VIDEO_PROVIDERS, defaultModelFor,
} from '../lib/models';
import { useProviderModels, labelWithNew } from '../lib/googleModels';
import { clearAllGenerations } from '../lib/storage';
import { pingProvider } from '../lib/api';

interface RoleConfig {
  role: Role;
  label: string;
  providers: Provider[];
}

const ROLE_CONFIG: RoleConfig[] = [
  { role: 'text',  label: 'LLM (Text) API key', providers: TEXT_PROVIDERS  },
  { role: 'image', label: 'Image API key',      providers: IMAGE_PROVIDERS },
  { role: 'video', label: 'Video API key',      providers: VIDEO_PROVIDERS },
];

function placeholderFor(p: Provider): string {
  switch (p) {
    case 'google':       return 'AIza…';
    case 'anthropic':    return 'sk-ant-…';
    case 'fal':          return 'fal-…';
    case 'openai':       return 'sk-…';
    case 'azure-openai': return 'Azure API key';
  }
}

export function SettingsModal() {
  const { state, dispatch } = useStore();
  const open = state.ui.settingsOpen;
  const [draft, setDraft] = useState(state.settings);
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<Partial<Record<Role, boolean>>>({});

  function close() { dispatch({ type: 'ui/openSettings', open: false }); }

  function setRole(role: Role, patch: Partial<{ provider: Provider; key: string; endpoint: string; deployment: string; apiVersion: string }>) {
    setDraft((d) => {
      const current = d.apiKeys[role] ?? { provider: 'google' as Provider, key: '' };
      const next: ApiKeys = {
        ...d.apiKeys,
        [role]: {
          provider: patch.provider ?? current.provider,
          key: patch.key ?? current.key,
          endpoint: patch.endpoint ?? current.endpoint,
          deployment: patch.deployment ?? current.deployment,
          apiVersion: patch.apiVersion ?? current.apiVersion,
        },
      };
      const out = { ...d, apiKeys: next };
      // If the role's provider changed, snap its default model to one supported by that provider.
      if (patch.provider) {
        if (role === 'text')  out.defaultTextModel  = defaultModelFor(TEXT_MODELS,  patch.provider);
        if (role === 'image') out.defaultImageModel = defaultModelFor(IMAGE_MODELS, patch.provider);
        if (role === 'video') out.defaultVideoModel = defaultModelFor(VIDEO_MODELS, patch.provider);
      }
      return out;
    });
    setResults((r) => ({ ...r, [role]: undefined }));
  }

  function copyFromText(role: Role) {
    const src = draft.apiKeys.text;
    if (!src?.key) return;
    setRole(role, {
      provider: src.provider,
      key: src.key,
      endpoint: src.endpoint,
      deployment: src.deployment,
      apiVersion: src.apiVersion,
    });
  }

  function save() {
    const cleaned: ApiKeys = {};
    for (const role of ['text', 'image', 'video'] as Role[]) {
      const r = draft.apiKeys[role];
      if (r?.key?.trim()) {
        cleaned[role] = {
          provider: r.provider,
          key: r.key.trim(),
          ...(r.endpoint   ? { endpoint:   r.endpoint.trim() }   : {}),
          ...(r.deployment ? { deployment: r.deployment.trim() } : {}),
          ...(r.apiVersion ? { apiVersion: r.apiVersion.trim() } : {}),
        };
      }
    }
    const next = { ...draft, apiKeys: cleaned, setupComplete: true };
    saveSettings(next);
    dispatch({ type: 'settings/set', settings: next });
    close();
    dispatch({ type: 'ui/toast', toast: { kind: 'success', message: 'Settings updated.' } });
  }

  async function test() {
    setTesting(true);
    setResults({});
    const entries = (['text', 'image', 'video'] as Role[]).map(async (role) => {
      const r = draft.apiKeys[role];
      if (!r?.key) return [role, undefined] as const;
      const ok = await pingProvider(r.provider, r.key, {
        endpoint: r.endpoint,
        deployment: r.deployment,
        apiVersion: r.apiVersion,
      });
      return [role, ok] as const;
    });
    const settled = await Promise.all(entries);
    const next: Partial<Record<Role, boolean>> = {};
    for (const [role, ok] of settled) next[role] = ok;
    setResults(next);
    setTesting(false);
  }

  async function purgeHistory() {
    if (!confirm('Delete all generated images and videos from history? Your uploaded assets are kept.')) return;
    await clearAllGenerations();
    dispatch({ type: 'generations/clear' });
    dispatch({ type: 'ui/toast', toast: { kind: 'success', message: 'History cleared.' } });
  }

  const textProv  = draft.apiKeys.text?.provider  ?? 'google';
  const imageProv = draft.apiKeys.image?.provider ?? 'google';
  const videoProv = draft.apiKeys.video?.provider ?? 'google';

  const textModelOptions  = useProviderModels('text',  textProv,  draft.apiKeys.text?.key);
  const imageModelOptions = useProviderModels('image', imageProv, draft.apiKeys.image?.key);
  const videoModelOptions = useProviderModels('video', videoProv, draft.apiKeys.video?.key);

  return (
    <Modal open={open} onClose={close} title="Settings" wide>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-ink-100">API keys</h3>

          {ROLE_CONFIG.map(({ role, label, providers }) => {
            const r = draft.apiKeys[role] ?? { provider: 'google' as Provider, key: '' };
            const showCopy = role !== 'text' && Boolean(draft.apiKeys.text?.key);
            const isAzure = r.provider === 'azure-openai';
            return (
              <Field key={role} label={label}>
                <div className="flex items-center gap-2">
                  <Select<Provider>
                    value={r.provider}
                    onChange={(p) => setRole(role, { provider: p })}
                    options={providers.map((p) => ({ value: p, label: PROVIDER_LABEL[p] }))}
                    className="!w-40 shrink-0"
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
                {isAzure && (
                  <div className="mt-2 grid grid-cols-1 gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 sm:grid-cols-3">
                    <TextInput
                      value={r.endpoint ?? ''}
                      onChange={(v) => setRole(role, { endpoint: v })}
                      placeholder="https://your-resource.openai.azure.com"
                    />
                    <TextInput
                      value={r.deployment ?? ''}
                      onChange={(v) => setRole(role, { deployment: v })}
                      placeholder="Deployment name"
                    />
                    <TextInput
                      value={r.apiVersion ?? ''}
                      onChange={(v) => setRole(role, { apiVersion: v })}
                      placeholder="API version (default 2024-10-21)"
                    />
                  </div>
                )}
              </Field>
            );
          })}

          <Button variant="ghost" size="sm" onClick={test} disabled={testing}>
            {testing ? <Spinner size={14} /> : <KeyRound size={14} />} Test keys
          </Button>
        </div>

        <div className="space-y-4">
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-ink-100">Default models</h3>

          <Field label={`Text / ideation (${PROVIDER_LABEL[textProv]})`}>
            <Select value={draft.defaultTextModel} onChange={(v) => setDraft({ ...draft, defaultTextModel: v })}
              options={textModelOptions.map((m) => ({ value: m.id, label: labelWithNew(m.name, m.isNew), hint: m.description }))} />
          </Field>

          <Field label={`Image (${PROVIDER_LABEL[imageProv]})`}>
            <Select value={draft.defaultImageModel} onChange={(v) => setDraft({ ...draft, defaultImageModel: v })}
              options={imageModelOptions.map((m) => ({ value: m.id, label: labelWithNew(m.name, m.isNew), hint: m.description }))} />
          </Field>

          <Field label={`Video (${PROVIDER_LABEL[videoProv]})`}>
            <Select value={draft.defaultVideoModel} onChange={(v) => setDraft({ ...draft, defaultVideoModel: v })}
              options={videoModelOptions.map((m) => ({ value: m.id, label: labelWithNew(m.name, m.isNew), hint: m.description }))} />
          </Field>

          <div className="border-t border-ink-700 pt-4">
            <Button variant="danger" size="sm" onClick={purgeHistory}>
              <Trash2 size={14} /> Clear generation history
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-2 border-t border-ink-700 pt-4">
        <Button variant="ghost" onClick={close}>Cancel</Button>
        <Button variant="primary" onClick={save}>
          <Check size={16} /> Save
        </Button>
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
