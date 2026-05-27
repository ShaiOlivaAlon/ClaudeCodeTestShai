import type { ApiKeys, Asset, BriefPreset, GameProject, Generation, ReskinProject, Settings } from '../types';

const DB_NAME = 'playtika-artist-studio';
const DB_VERSION = 5;
const STORE_ASSETS = 'assets';
const STORE_GENERATIONS = 'generations';
const STORE_PRESETS = 'briefPresets';
const STORE_IMAGE_CACHE = 'imageCache';
const STORE_VIDEO_CACHE = 'videoCache';
const STORE_GAME_PROJECTS = 'gameProjects';
const STORE_RESKIN_PROJECTS = 'reskinProjects';
const SETTINGS_KEY = 'pas.settings.v1';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_ASSETS)) {
        db.createObjectStore(STORE_ASSETS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_GENERATIONS)) {
        db.createObjectStore(STORE_GENERATIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PRESETS)) {
        db.createObjectStore(STORE_PRESETS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_IMAGE_CACHE)) {
        db.createObjectStore(STORE_IMAGE_CACHE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_VIDEO_CACHE)) {
        db.createObjectStore(STORE_VIDEO_CACHE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_GAME_PROJECTS)) {
        db.createObjectStore(STORE_GAME_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_RESKIN_PROJECTS)) {
        db.createObjectStore(STORE_RESKIN_PROJECTS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T> | Promise<T>): Promise<T> {
  return openDb().then((db) =>
    new Promise<T>((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      const result = run(s);
      if (result instanceof Promise) {
        result.then(resolve, reject);
      } else {
        result.onsuccess = () => resolve(result.result as T);
        result.onerror = () => reject(result.error);
      }
    })
  );
}

// --- Settings ---------------------------------------------------------------

export const DEFAULT_SETTINGS: Settings = {
  apiKeys: {},
  defaultTextModel: 'gemini-2.5-flash',
  defaultImageModel: 'gemini-3-pro-image-preview',
  defaultVideoModel: 'veo-3.1-generate-preview',
  setupComplete: false,
};

/** Migrate the pre-role flat key shape ({ anthropic, fal, openai }) to role-based. */
function migrateApiKeys(raw: unknown): ApiKeys {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  // Already role-based?
  const looksRoleBased = ['text', 'image', 'video'].some((k) => {
    const v = r[k];
    return v && typeof v === 'object' && 'provider' in (v as object);
  });
  if (looksRoleBased) {
    const out: ApiKeys = {};
    for (const role of ['text', 'image', 'video'] as const) {
      const v = r[role] as { provider?: string; key?: string; endpoint?: string; deployment?: string; apiVersion?: string } | undefined;
      if (v?.key && v.provider) {
        out[role] = {
          provider: v.provider as any,
          key: v.key,
          ...(v.endpoint   ? { endpoint:   v.endpoint }   : {}),
          ...(v.deployment ? { deployment: v.deployment } : {}),
          ...(v.apiVersion ? { apiVersion: v.apiVersion } : {}),
        };
      }
    }
    return out;
  }
  // Legacy flat shape: { anthropic, fal, openai }
  const out: ApiKeys = {};
  const ant = typeof r.anthropic === 'string' ? r.anthropic.trim() : '';
  const fal = typeof r.fal === 'string' ? r.fal.trim() : '';
  if (ant) out.text = { provider: 'anthropic', key: ant };
  if (fal) {
    out.image = { provider: 'fal', key: fal };
    out.video = { provider: 'fal', key: fal };
  }
  return out;
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings> & { apiKeys?: unknown };
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      apiKeys: migrateApiKeys(parsed.apiKeys),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// --- Assets -----------------------------------------------------------------

export async function listAssets(): Promise<Asset[]> {
  return tx<Asset[]>(STORE_ASSETS, 'readonly', (s) => {
    return new Promise<Asset[]>((resolve, reject) => {
      const req = s.getAll();
      req.onsuccess = () => resolve((req.result as Asset[]).sort((a, b) => b.createdAt - a.createdAt));
      req.onerror = () => reject(req.error);
    });
  });
}

export async function putAsset(a: Asset): Promise<void> {
  await tx<void>(STORE_ASSETS, 'readwrite', (s) => {
    return new Promise<void>((resolve, reject) => {
      const req = s.put(a);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

export async function deleteAsset(id: string): Promise<void> {
  await tx<void>(STORE_ASSETS, 'readwrite', (s) => {
    return new Promise<void>((resolve, reject) => {
      const req = s.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

// --- Generations ------------------------------------------------------------

export async function listGenerations(): Promise<Generation[]> {
  return tx<Generation[]>(STORE_GENERATIONS, 'readonly', (s) => {
    return new Promise<Generation[]>((resolve, reject) => {
      const req = s.getAll();
      req.onsuccess = () => resolve((req.result as Generation[]).sort((a, b) => b.createdAt - a.createdAt));
      req.onerror = () => reject(req.error);
    });
  });
}

export async function putGeneration(g: Generation): Promise<void> {
  await tx<void>(STORE_GENERATIONS, 'readwrite', (s) => {
    return new Promise<void>((resolve, reject) => {
      const req = s.put(g);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

export async function deleteGeneration(id: string): Promise<void> {
  await tx<void>(STORE_GENERATIONS, 'readwrite', (s) => {
    return new Promise<void>((resolve, reject) => {
      const req = s.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

export async function clearAllGenerations(): Promise<void> {
  await tx<void>(STORE_GENERATIONS, 'readwrite', (s) => {
    return new Promise<void>((resolve, reject) => {
      const req = s.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

// --- Brief presets ----------------------------------------------------------

export async function listBriefPresets(): Promise<BriefPreset[]> {
  return tx<BriefPreset[]>(STORE_PRESETS, 'readonly', (s) => {
    return new Promise<BriefPreset[]>((resolve, reject) => {
      const req = s.getAll();
      req.onsuccess = () => resolve((req.result as BriefPreset[]).sort((a, b) => b.createdAt - a.createdAt));
      req.onerror = () => reject(req.error);
    });
  });
}

export async function putBriefPreset(p: BriefPreset): Promise<void> {
  await tx<void>(STORE_PRESETS, 'readwrite', (s) => {
    return new Promise<void>((resolve, reject) => {
      const req = s.put(p);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

export async function deleteBriefPreset(id: string): Promise<void> {
  await tx<void>(STORE_PRESETS, 'readwrite', (s) => {
    return new Promise<void>((resolve, reject) => {
      const req = s.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

// --- Content-keyed render cache --------------------------------------------

interface CacheEntry { key: string; url: string; createdAt: number }

function cacheGet(store: string, key: string): Promise<string | null> {
  return tx<string | null>(store, 'readonly', (s) => {
    return new Promise<string | null>((resolve, reject) => {
      const req = s.get(key);
      req.onsuccess = () => resolve((req.result as CacheEntry | undefined)?.url ?? null);
      req.onerror = () => reject(req.error);
    });
  });
}

function cachePut(store: string, key: string, url: string): Promise<void> {
  return tx<void>(store, 'readwrite', (s) => {
    return new Promise<void>((resolve, reject) => {
      const req = s.put({ key, url, createdAt: Date.now() } as CacheEntry);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

export const getCachedImage = (key: string) => cacheGet(STORE_IMAGE_CACHE, key);
export const putCachedImage = (key: string, url: string) => cachePut(STORE_IMAGE_CACHE, key, url);
export const getCachedVideo = (key: string) => cacheGet(STORE_VIDEO_CACHE, key);
export const putCachedVideo = (key: string, url: string) => cachePut(STORE_VIDEO_CACHE, key, url);

// --- Game projects ---------------------------------------------------------

export async function listGameProjects(): Promise<GameProject[]> {
  return tx<GameProject[]>(STORE_GAME_PROJECTS, 'readonly', (s) => {
    return new Promise<GameProject[]>((resolve, reject) => {
      const req = s.getAll();
      req.onsuccess = () => resolve((req.result as GameProject[]).sort((a, b) => b.updatedAt - a.updatedAt));
      req.onerror = () => reject(req.error);
    });
  });
}

export async function putGameProject(p: GameProject): Promise<void> {
  await tx<void>(STORE_GAME_PROJECTS, 'readwrite', (s) => {
    return new Promise<void>((resolve, reject) => {
      const req = s.put(p);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

export async function deleteGameProject(id: string): Promise<void> {
  await tx<void>(STORE_GAME_PROJECTS, 'readwrite', (s) => {
    return new Promise<void>((resolve, reject) => {
      const req = s.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

// --- Reskin projects -------------------------------------------------------

export async function listReskinProjects(): Promise<ReskinProject[]> {
  return tx<ReskinProject[]>(STORE_RESKIN_PROJECTS, 'readonly', (s) => {
    return new Promise<ReskinProject[]>((resolve, reject) => {
      const req = s.getAll();
      req.onsuccess = () => resolve((req.result as ReskinProject[]).sort((a, b) => b.updatedAt - a.updatedAt));
      req.onerror = () => reject(req.error);
    });
  });
}

export async function putReskinProject(p: ReskinProject): Promise<void> {
  await tx<void>(STORE_RESKIN_PROJECTS, 'readwrite', (s) => {
    return new Promise<void>((resolve, reject) => {
      const req = s.put(p);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}

export async function deleteReskinProject(id: string): Promise<void> {
  await tx<void>(STORE_RESKIN_PROJECTS, 'readwrite', (s) => {
    return new Promise<void>((resolve, reject) => {
      const req = s.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });
}
