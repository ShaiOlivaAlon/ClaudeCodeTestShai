import { AlertCircle } from 'lucide-react';
import { ProviderId } from '../types';
import { PROVIDERS, PROVIDER_LIST } from '../providers/registry';

interface Props {
  capability: 'image' | 'video';
  value: ProviderId;
  onChange: (id: ProviderId) => void;
  models: string[];
  model: string;
  onModelChange: (m: string) => void;
}

export default function ProviderPicker({
  capability,
  value,
  onChange,
  models,
  model,
  onModelChange,
}: Props) {
  const meta = PROVIDERS[value];
  const filtered = PROVIDER_LIST.filter((p) => p.capabilities.includes(capability));
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-semibold text-gray-700">Provider</label>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value as ProviderId)}
            className="input-field mt-1"
          >
            {filtered.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} {p.browserDirect ? '' : '· proxy required'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700">Model</label>
          {models.length > 0 ? (
            <select
              value={model}
              onChange={(e) => onModelChange(e.target.value)}
              className="input-field mt-1"
            >
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
              {!models.includes(model) && <option value={model}>{model} (custom)</option>}
            </select>
          ) : (
            <input
              className="input-field mt-1"
              value={model}
              onChange={(e) => onModelChange(e.target.value)}
              placeholder="model id"
            />
          )}
        </div>
      </div>
      {!meta.browserDirect && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 text-amber-900 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            <strong>{meta.label}</strong> blocks direct browser calls (CORS). The job will
            error unless you point this app at a relay you control. Pick FAL.AI, Google AI
            Studio, Runway, or LiteLLM for direct calls.
          </span>
        </div>
      )}
    </div>
  );
}
