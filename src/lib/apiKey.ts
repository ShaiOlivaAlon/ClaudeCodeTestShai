const STORAGE_KEY = 'playtika.art-studio.gemini-key';

export function getStoredKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredKey(key: string) {
  try {
    if (key) localStorage.setItem(STORAGE_KEY, key);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode etc — silently ignore */
  }
}

const listeners = new Set<(key: string) => void>();

export function onKeyChange(fn: (key: string) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function emitKeyChange(key: string) {
  setStoredKey(key);
  listeners.forEach((fn) => fn(key));
}
