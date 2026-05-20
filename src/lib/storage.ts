import type { Asset, Generation, Settings } from '../types';

const DB_NAME = 'playtika-artist-studio';
const DB_VERSION = 1;
const STORE_ASSETS = 'assets';
const STORE_GENERATIONS = 'generations';
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
  defaultTextModel: 'claude-sonnet-4-6',
  defaultImageModel: 'fal-ai/flux-pro/v1.1',
  defaultVideoModel: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
  setupComplete: false,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed, apiKeys: { ...parsed.apiKeys } };
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
