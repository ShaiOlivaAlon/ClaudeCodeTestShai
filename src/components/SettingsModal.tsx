import { useState } from 'react';
import { Check, KeyRound, Trash2 } from 'lucide-react';
import { useStore } from '../state/store';
import { saveSettings } from '../lib/storage';
import { Button, Field, Modal, Select, Spinner, TextInput } from './ui';
import { IMAGE_MODELS, TEXT_MODELS, VIDEO_MODELS } from '../lib/models';
import { clearAllGenerations } from '../lib/storage';
import { pingAnthropic, pingFal } from '../lib/api';

export function SettingsModal() {
  const { state, dispatch } = useStore();
  const open = state.ui.settingsOpen;
  const [draft, setDraft] = useState(state.settings);
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<{ anthropic?: boolean; fal?: boolean }>({});

  function close() { dispatch({ type: 'ui/openSettings', open: false }); }

  function save() {
    const next = { ...draft, setupComplete: true };
    saveSettings(next);
    dispatch({ type: 'settings/set', settings: next });
    close();
    dispatch({ type: 'ui/toast', toast: { kind: 'success', message: 'Settings updated.' } });
  }

  async function test() {
    setTesting(true);
    setResults({});
    const [a, f] = await Promise.all([
      draft.apiKeys.anthropic ? pingAnthropic(draft.apiKeys.anthropic) : Promise.resolve(undefined as any),
      draft.apiKeys.fal ? pingFal(draft.apiKeys.fal) : Promise.resolve(undefined as any),
    ]);
    setResults({ anthropic: a, fal: f });
    setTesting(false);
  }

  async function purgeHistory() {
    if (!confirm('Delete all generated images and videos from history? Your uploaded assets are kept.')) return;
    await clearAllGenerations();
    dispatch({ type: 'generations/clear' });
    dispatch({ type: 'ui/toast', toast: { kind: 'success', message: 'History cleared.' } });
  }

  return (
    <Modal open={open} onClose={close} title="Settings" wide>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-ink-100">API keys</h3>

          <Field label="Anthropic">
            <div className="flex items-center gap-2">
              <TextInput type="password" value={draft.apiKeys.anthropic ?? ''}
                onChange={(v) => setDraft({ ...draft, apiKeys: { ...draft.apiKeys, anthropic: v } })}
                placeholder="sk-ant-…" />
              <KeyResult ok={results.anthropic} />
            </div>
          </Field>

          <Field label="fal.ai">
            <div className="flex items-center gap-2">
              <TextInput type="password" value={draft.apiKeys.fal ?? ''}
                onChange={(v) => setDraft({ ...draft, apiKeys: { ...draft.apiKeys, fal: v } })}
                placeholder="fal-…" />
              <KeyResult ok={results.fal} />
            </div>
          </Field>

          <Field label="OpenAI (optional)">
            <TextInput type="password" value={draft.apiKeys.openai ?? ''}
              onChange={(v) => setDraft({ ...draft, apiKeys: { ...draft.apiKeys, openai: v } })}
              placeholder="sk-…" />
          </Field>

          <Button variant="ghost" size="sm" onClick={test} disabled={testing}>
            {testing ? <Spinner size={14} /> : <KeyRound size={14} />} Test keys
          </Button>
        </div>

        <div className="space-y-4">
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-ink-100">Default models</h3>

          <Field label="Text / ideation">
            <Select value={draft.defaultTextModel} onChange={(v) => setDraft({ ...draft, defaultTextModel: v })}
              options={TEXT_MODELS.map((m) => ({ value: m.id, label: m.name, hint: m.description }))} />
          </Field>

          <Field label="Image">
            <Select value={draft.defaultImageModel} onChange={(v) => setDraft({ ...draft, defaultImageModel: v })}
              options={IMAGE_MODELS.map((m) => ({ value: m.id, label: m.name, hint: m.description }))} />
          </Field>

          <Field label="Video">
            <Select value={draft.defaultVideoModel} onChange={(v) => setDraft({ ...draft, defaultVideoModel: v })}
              options={VIDEO_MODELS.map((m) => ({ value: m.id, label: m.name, hint: m.description }))} />
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
  if (ok === undefined) return null;
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
