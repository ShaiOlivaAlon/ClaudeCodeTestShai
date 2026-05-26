import { useState } from 'react';
import { Eye, EyeOff, ExternalLink, ShieldAlert, Trash2 } from 'lucide-react';
import { useArt } from '../store';
import { PROVIDER_LIST } from '../providers/registry';
import { ApiKeys } from '../types';
import { clearKeys } from '../utils/keys';
import { clearAll } from '../utils/storage';

interface FieldDef {
  field: keyof ApiKeys;
  label: string;
  placeholder: string;
  secret: boolean;
}

const PROVIDER_FIELDS: Record<string, FieldDef[]> = {
  fal: [{ field: 'fal', label: 'API Key', placeholder: 'fal_...', secret: true }],
  google: [{ field: 'google', label: 'API Key', placeholder: 'AIza…', secret: true }],
  runway: [{ field: 'runway', label: 'API Key', placeholder: 'key_…', secret: true }],
  litellm: [
    { field: 'litellmBase', label: 'Base URL', placeholder: 'https://litellm.example.com', secret: false },
    { field: 'litellm', label: 'API Key', placeholder: 'sk-…', secret: true },
  ],
  openai: [{ field: 'openai', label: 'API Key', placeholder: 'sk-…', secret: true }],
  azure: [
    { field: 'azureBase', label: 'Endpoint', placeholder: 'https://<resource>.openai.azure.com', secret: false },
    { field: 'azure', label: 'API Key', placeholder: 'key', secret: true },
  ],
  claude: [{ field: 'claude', label: 'API Key', placeholder: 'sk-ant-…', secret: true }],
  aws: [
    { field: 'aws', label: 'Access Key ID', placeholder: 'AKIA…', secret: true },
    { field: 'awsSecret', label: 'Secret Access Key', placeholder: '…', secret: true },
    { field: 'awsRegion', label: 'Region', placeholder: 'us-east-1', secret: false },
  ],
  gcp: [
    { field: 'gcp', label: 'API Key / Token', placeholder: '…', secret: true },
    { field: 'gcpProject', label: 'Project ID', placeholder: 'my-project', secret: false },
  ],
};

export default function SettingsTab() {
  const { keys, setKeys } = useArt();
  const [reveal, setReveal] = useState<Record<string, boolean>>({});

  const update = (k: keyof ApiKeys, v: string) => setKeys({ ...keys, [k]: v });

  return (
    <div className="space-y-6 p-4 max-w-3xl mx-auto">
      <section>
        <h2 className="text-lg font-bold">API Keys</h2>
        <p className="text-sm text-gray-600 mt-1">
          Keys are stored in your browser's localStorage and used only for direct API
          calls from this device.
        </p>
        <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-amber-50 text-amber-900 text-sm">
          <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            <strong>Security:</strong> This is a static, client-only app. Any provider
            whose API supports browser CORS will receive your key in network requests
            from this device. Keys are <em>not</em> encrypted in localStorage. Don't use
            production keys; prefer scoped or read-limited keys.
          </span>
        </div>
      </section>

      {PROVIDER_LIST.map((p) => {
        const fields = PROVIDER_FIELDS[p.id] ?? [];
        return (
          <section key={p.id} className="card p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-bold">{p.label}</h3>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  {p.capabilities.join(' · ')} · {p.browserDirect ? (
                    <span className="text-green-700">direct browser calls</span>
                  ) : (
                    <span className="text-amber-700">requires proxy</span>
                  )}
                </div>
              </div>
              <a
                href={p.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary-600 inline-flex items-center gap-1"
              >
                Get key <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            {fields.map(({ field, label, placeholder, secret }) => {
              const revealKey = `${p.id}.${field}`;
              const shown = !secret || reveal[revealKey];
              return (
                <div key={field}>
                  <label className="text-xs font-semibold text-gray-700">{label}</label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type={shown ? 'text' : 'password'}
                      value={(keys[field] as string) ?? ''}
                      onChange={(e) => update(field, e.target.value)}
                      placeholder={placeholder}
                      className="input-field"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    {secret && (
                      <button
                        type="button"
                        onClick={() => setReveal((r) => ({ ...r, [revealKey]: !r[revealKey] }))}
                        className="px-3 rounded-xl bg-gray-100 hover:bg-gray-200"
                        title={shown ? 'Hide' : 'Show'}
                      >
                        {shown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {p.endpointHint && (
              <div className="text-[11px] text-gray-500 italic">{p.endpointHint}</div>
            )}
          </section>
        );
      })}

      <section className="card p-4 space-y-3">
        <h3 className="font-bold">Danger zone</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              if (confirm('Wipe all stored API keys?')) {
                clearKeys();
                setKeys({});
              }
            }}
            className="btn-danger inline-flex items-center gap-1"
          >
            <Trash2 className="w-4 h-4" /> Wipe API keys
          </button>
          <button
            onClick={() => {
              if (confirm('Delete all uploaded assets, reskins, and animations from this browser?')) {
                void clearAll();
                location.reload();
              }
            }}
            className="btn-danger inline-flex items-center gap-1"
          >
            <Trash2 className="w-4 h-4" /> Wipe local data
          </button>
        </div>
      </section>
    </div>
  );
}
