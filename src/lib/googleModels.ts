import { useEffect, useState } from 'react';
import type { Provider } from '../types';
import { type ModelDef, IMAGE_MODELS, TEXT_MODELS, VIDEO_MODELS, modelsForProvider } from './models';

type Role = 'text' | 'image' | 'video';

const GOOGLE_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const FIRST_SEEN_KEY = 'pas.modelFirstSeen.v1';
/** How long a freshly-discovered model is flagged as NEW. */
const NEW_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface RawGoogleModel {
  name: string;
  displayName?: string;
  description?: string;
  supportedGenerationMethods?: string[];
}

const CURATED_BY_ROLE: Record<Role, ModelDef[]> = {
  text: TEXT_MODELS,
  image: IMAGE_MODELS,
  video: VIDEO_MODELS,
};

const fetchMemo = new Map<string, Promise<RawGoogleModel[]>>();

async function doFetchGoogleModels(apiKey: string): Promise<RawGoogleModel[]> {
  let all: RawGoogleModel[] = [];
  let pageToken: string | undefined;
  do {
    const u = new URL(`${GOOGLE_BASE}/models`);
    u.searchParams.set('key', apiKey);
    u.searchParams.set('pageSize', '200');
    if (pageToken) u.searchParams.set('pageToken', pageToken);
    const res = await fetch(u.toString());
    if (!res.ok) throw new Error(`ListModels ${res.status}`);
    const data = await res.json();
    all = all.concat((data.models ?? []) as RawGoogleModel[]);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return all;
}

function fetchGoogleModels(apiKey: string): Promise<RawGoogleModel[]> {
  if (fetchMemo.has(apiKey)) return fetchMemo.get(apiKey)!;
  const p = doFetchGoogleModels(apiKey).catch((err) => {
    fetchMemo.delete(apiKey);
    throw err;
  });
  fetchMemo.set(apiKey, p);
  return p;
}

function categorizeRole(rawName: string, methods: string[] = []): Role | null {
  const id = rawName.replace(/^models\//, '').toLowerCase();
  if (id.includes('embedding') || id.includes('aqa') || id.includes('bison')) return null;
  if (id.includes('veo') || methods.includes('predictLongRunning')) return 'video';
  if (id.includes('imagen') || id.includes('image')) return 'image';
  if (id.includes('gemini') || methods.includes('generateContent')) return 'text';
  return null;
}

interface FirstSeenStore {
  ids: Record<string, number>;
  initialized: boolean;
}

function readFirstSeen(): FirstSeenStore {
  try {
    const raw = localStorage.getItem(FIRST_SEEN_KEY);
    if (!raw) return { ids: {}, initialized: false };
    return JSON.parse(raw) as FirstSeenStore;
  } catch {
    return { ids: {}, initialized: false };
  }
}

function writeFirstSeen(s: FirstSeenStore): void {
  try { localStorage.setItem(FIRST_SEEN_KEY, JSON.stringify(s)); } catch {}
}

/**
 * Record every id we've now seen. On the very first call ever, all current ids
 * are baseline-stamped at ts=0 so nothing flashes NEW the first time the app
 * runs. On subsequent calls, any unseen id gets stamped at `now` — that ts is
 * what drives the NEW badge for the next NEW_WINDOW_MS.
 */
function markAndFlagNew(ids: string[]): Record<string, boolean> {
  const store = readFirstSeen();
  const now = Date.now();
  let dirty = false;

  if (!store.initialized) {
    for (const id of ids) store.ids[id] = 0;
    store.initialized = true;
    dirty = true;
  } else {
    for (const id of ids) {
      if (!(id in store.ids)) {
        store.ids[id] = now;
        dirty = true;
      }
    }
  }
  if (dirty) writeFirstSeen(store);

  const out: Record<string, boolean> = {};
  for (const id of ids) {
    const ts = store.ids[id] ?? 0;
    out[id] = ts > 0 && now - ts < NEW_WINDOW_MS;
  }
  return out;
}

export interface ProviderModel extends ModelDef {
  isNew: boolean;
}

interface RawLitellmModel { id: string; created?: number; owned_by?: string }

const litellmMemo = new Map<string, Promise<RawLitellmModel[]>>();

async function doFetchLitellmModels(endpoint: string, apiKey: string): Promise<RawLitellmModel[]> {
  const url = `${endpoint.replace(/\/$/, '')}/v1/models`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) throw new Error(`LiteLLM /v1/models ${res.status}`);
  const data = await res.json();
  return (data?.data ?? []) as RawLitellmModel[];
}

function fetchLitellmModels(endpoint: string, apiKey: string): Promise<RawLitellmModel[]> {
  const key = `${endpoint}::${apiKey}`;
  if (litellmMemo.has(key)) return litellmMemo.get(key)!;
  const p = doFetchLitellmModels(endpoint, apiKey).catch((err) => {
    litellmMemo.delete(key);
    throw err;
  });
  litellmMemo.set(key, p);
  return p;
}

/** Best-effort classification of a LiteLLM model id by name. Many proxies don't
 *  expose modality in /v1/models, so we filter heuristically. */
function classifyLitellmModel(id: string): Role | null {
  const s = id.toLowerCase();
  if (s.includes('dall-e') || s.includes('gpt-image') || s.includes('imagen') ||
      s.includes('flux') || s.includes('recraft') || s.includes('ideogram') ||
      s.includes('stable-diffusion') || s.includes(' sdxl') || s.includes('sd-')) return 'image';
  if (s.includes('veo') || s.includes('kling') || s.includes('runway') || s.includes('luma') || s.includes('-video')) return 'video';
  // Heuristic: chat-completion-capable models — anything that LiteLLM commonly proxies.
  return 'text';
}

async function loadProviderModels(
  role: Role,
  provider: Provider,
  apiKey: string | undefined,
  endpoint: string | undefined,
): Promise<ProviderModel[]> {
  const curated = modelsForProvider(CURATED_BY_ROLE[role], provider);

  let dynamic: ModelDef[] = [];
  if (provider === 'google' && apiKey) {
    try {
      const raw = await fetchGoogleModels(apiKey);
      dynamic = raw
        .filter((m) => categorizeRole(m.name, m.supportedGenerationMethods) === role)
        .map((m) => {
          const id = m.name.replace(/^models\//, '');
          return {
            id,
            provider: 'google' as Provider,
            name: m.displayName?.trim() || id,
            description: m.description?.trim().split('\n')[0]?.slice(0, 120),
          };
        });
    } catch {
      // Network/auth failure: silently fall back to curated.
    }
  } else if (provider === 'litellm' && apiKey && endpoint) {
    try {
      const raw = await fetchLitellmModels(endpoint, apiKey);
      dynamic = raw
        .filter((m) => classifyLitellmModel(m.id) === role)
        .map((m) => ({
          id: m.id,
          provider: 'litellm' as Provider,
          name: m.id,
          description: m.owned_by ? `via ${m.owned_by} (LiteLLM)` : 'via LiteLLM',
        }));
    } catch {
      // Network/auth failure: silently fall back to the placeholder curated entry.
    }
  }

  // Curated entries take precedence (better display names + descriptions),
  // dynamic entries fill in anything else the user's key reports.
  const merged = new Map<string, ModelDef>();
  for (const m of dynamic)  merged.set(m.id, m);
  for (const m of curated)  merged.set(m.id, m);

  // For LiteLLM, drop the "auto-detected" placeholder once real models load.
  if (provider === 'litellm' && dynamic.length > 0) {
    merged.delete('litellm-default');
    merged.delete('litellm-image-default');
  }

  const list = Array.from(merged.values());
  const flags = markAndFlagNew(list.map((m) => m.id));
  return list.map((m) => ({ ...m, isNew: flags[m.id] ?? false }));
}

/** React hook: returns the merged curated + dynamically-discovered models for a
 *  given role + provider, each tagged with isNew. */
export function useProviderModels(
  role: Role,
  provider: Provider,
  apiKey: string | undefined,
  endpoint?: string,
): ProviderModel[] {
  const [models, setModels] = useState<ProviderModel[]>(() =>
    modelsForProvider(CURATED_BY_ROLE[role], provider).map((m) => ({ ...m, isNew: false })),
  );

  useEffect(() => {
    let cancelled = false;
    loadProviderModels(role, provider, apiKey, endpoint).then((ms) => {
      if (!cancelled) setModels(ms);
    });
    return () => { cancelled = true; };
  }, [role, provider, apiKey, endpoint]);

  return models;
}

/** "Gemini 3 Pro" → "Gemini 3 Pro 🆕 NEW" when flagged. */
export function labelWithNew(name: string, isNew: boolean): string {
  return isNew ? `${name} 🆕 NEW` : name;
}
