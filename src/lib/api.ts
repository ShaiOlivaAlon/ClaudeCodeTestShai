import type { Asset, Brief, GeneratedImage, Suggestion } from '../types';
import { getStoredKey } from './apiKey';

function authHeaders(): Record<string, string> {
  const key = getStoredKey();
  return key ? { 'x-gemini-key': key } : {};
}

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export async function fetchSuggestions(brief: Brief, assets: Asset[]): Promise<Suggestion[]> {
  const hasAssets = {
    characters: assets.some((a) => a.kind === 'character'),
    items: assets.some((a) => a.kind === 'item'),
    logo: assets.some((a) => a.kind === 'logo'),
    references: assets.some((a) => a.kind === 'reference'),
  };
  const data = await postJSON<{ suggestions: Suggestion[] }>('/api/suggest', {
    brief,
    hasAssets,
  });
  return data.suggestions || [];
}

export async function generateImage(params: {
  prompt: string;
  aspect: string;
  model: 'imagen-4' | 'imagen-3' | 'gemini-image';
  count: number;
  references: { kind: Asset['kind']; dataUrl: string }[];
}): Promise<GeneratedImage[]> {
  const data = await postJSON<{
    images: { dataUrl: string; mimeType: string; model: string }[];
  }>('/api/generate', params);
  return data.images.map((img) => ({
    id: crypto.randomUUID(),
    dataUrl: img.dataUrl,
    mimeType: img.mimeType,
    model: img.model,
    aspect: params.aspect,
    prompt: params.prompt,
    createdAt: Date.now(),
  }));
}

export async function startVideoJob(params: {
  prompt: string;
  imageDataUrl?: string;
  model: 'veo-3' | 'veo-2';
  filenameHint?: string;
}): Promise<{ jobId: string }> {
  return await postJSON<{ jobId: string }>('/api/video', params);
}

export interface VideoJobStatus {
  status: 'pending' | 'done' | 'error';
  error?: string;
  url?: string;
  model?: string;
  sharepoint?: { webUrl: string; downloadUrl?: string; id?: string } | null;
}

export async function getVideoJob(jobId: string): Promise<VideoJobStatus> {
  const res = await fetch(`/api/video/${jobId}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Status ${res.status}`);
  return (await res.json()) as VideoJobStatus;
}

export async function generateVideo(
  params: {
    prompt: string;
    imageDataUrl?: string;
    model: 'veo-3' | 'veo-2';
    filenameHint?: string;
  },
  opts: { onJobId?: (jobId: string) => void; intervalMs?: number } = {}
): Promise<{ url: string; model: string; sharepoint?: VideoJobStatus['sharepoint'] }> {
  const { jobId } = await startVideoJob(params);
  opts.onJobId?.(jobId);
  const interval = opts.intervalMs ?? 5000;

  // Poll until done or error. No hard deadline here — the server caps Veo at 6 min.
  while (true) {
    await new Promise((r) => setTimeout(r, interval));
    const s = await getVideoJob(jobId);
    if (s.status === 'done') {
      return { url: s.url!, model: s.model!, sharepoint: s.sharepoint };
    }
    if (s.status === 'error') {
      throw new Error(s.error || 'Video generation failed');
    }
  }
}
