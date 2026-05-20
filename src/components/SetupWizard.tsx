import { useState } from 'react';
import { KeyRound, Sparkles, Check } from 'lucide-react';
import type { ApiKeys } from '../types';
import { useStore } from '../state/store';
import { saveSettings } from '../lib/storage';
import { Button, Modal, TextInput, Field, Spinner } from './ui';
import { pingAnthropic, pingFal } from '../lib/api';

export function SetupWizard() {
  const { state, dispatch } = useStore();
  const open = state.ui.setupOpen;

  const [keys, setKeys] = useState<ApiKeys>({
    anthropic: state.settings.apiKeys.anthropic ?? '',
    openai: state.settings.apiKeys.openai ?? '',
    fal: state.settings.apiKeys.fal ?? '',
  });
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<{ anthropic?: boolean; fal?: boolean }>({});

  async function test() {
    setTesting(true);
    setResults({});
    const [a, f] = await Promise.all([
      keys.anthropic ? pingAnthropic(keys.anthropic) : Promise.resolve(undefined as any),
      keys.fal ? pingFal(keys.fal) : Promise.resolve(undefined as any),
    ]);
    setResults({ anthropic: a, fal: f });
    setTesting(false);
  }

  function save() {
    const next = {
      ...state.settings,
      apiKeys: {
        anthropic: keys.anthropic?.trim() || undefined,
        openai: keys.openai?.trim() || undefined,
        fal: keys.fal?.trim() || undefined,
      },
      setupComplete: true,
    };
    saveSettings(next);
    dispatch({ type: 'settings/set', settings: next });
    dispatch({ type: 'ui/openSetup', open: false });
    dispatch({ type: 'ui/toast', toast: { kind: 'success', message: 'Studio is ready. Drop in some characters to get started.' } });
  }

  const canSave = Boolean(keys.anthropic?.trim() && keys.fal?.trim());

  return (
    <Modal open={open} onClose={() => { /* required field */ }} title="Welcome to Playtika Artist Studio">
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-lg border border-brand-400/30 bg-brand-500/10 p-3 text-sm text-brand-50">
          <Sparkles size={18} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Set up your model API keys</div>
            <div className="text-xs text-brand-100/80">
              Keys are stored locally in your browser only. They're used to call the providers directly from your machine — nothing
              is sent to Playtika servers. You can change them anytime from <strong>Settings</strong>.
            </div>
          </div>
        </div>

        <Field label="Anthropic API key" hint="for ideation & prompt enhancement">
          <div className="flex items-center gap-2">
            <TextInput
              type="password"
              value={keys.anthropic ?? ''}
              onChange={(v) => setKeys({ ...keys, anthropic: v })}
              placeholder="sk-ant-…"
            />
            <KeyResult ok={results.anthropic} />
          </div>
        </Field>

        <Field label="fal.ai API key" hint="for image & video generation">
          <div className="flex items-center gap-2">
            <TextInput
              type="password"
              value={keys.fal ?? ''}
              onChange={(v) => setKeys({ ...keys, fal: v })}
              placeholder="fal-…"
            />
            <KeyResult ok={results.fal} />
          </div>
        </Field>

        <Field label="OpenAI API key" hint="optional — enables GPT Image 1">
          <TextInput
            type="password"
            value={keys.openai ?? ''}
            onChange={(v) => setKeys({ ...keys, openai: v })}
            placeholder="sk-…"
          />
        </Field>

        <div className="flex items-center justify-between border-t border-ink-700 pt-4">
          <Button variant="ghost" size="sm" onClick={test} disabled={testing || (!keys.anthropic && !keys.fal)}>
            {testing ? <Spinner size={14} /> : <KeyRound size={14} />} Test keys
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={save} disabled={!canSave}>
              <Check size={16} /> Save & start
            </Button>
          </div>
        </div>
        {!canSave && (
          <p className="text-xs text-ink-400">Anthropic and fal.ai keys are required. OpenAI is optional.</p>
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
