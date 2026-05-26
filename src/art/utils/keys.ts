import { ApiKeys } from '../types';

const KEY = 'art-pipeline.apiKeys.v1';

/**
 * API keys live in localStorage. There is no real encryption — a browser-only
 * app cannot keep secrets from a determined user on the same machine. We
 * obfuscate lightly so casual inspection doesn't surface a raw key, and we
 * surface a clear warning in the UI.
 */
function obfuscate(s: string): string {
  return btoa(unescape(encodeURIComponent(s))).split('').reverse().join('');
}

function deobfuscate(s: string): string {
  try {
    return decodeURIComponent(escape(atob(s.split('').reverse().join(''))));
  } catch {
    return '';
  }
}

export function loadKeys(): ApiKeys {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(deobfuscate(raw));
  } catch {
    return {};
  }
}

export function saveKeys(keys: ApiKeys): void {
  localStorage.setItem(KEY, obfuscate(JSON.stringify(keys)));
}

export function clearKeys(): void {
  localStorage.removeItem(KEY);
}
