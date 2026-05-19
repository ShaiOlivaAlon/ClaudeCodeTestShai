import type { Asset, Brief, GeneratedImage, Suggestion } from '../types';

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

export async function generateVideo(params: {
  prompt: string;
  imageDataUrl?: string;
  model: 'veo-3' | 'veo-2';
}): Promise<{ dataUrl: string; model: string }> {
  const data = await postJSON<{ video: { dataUrl: string; model: string } }>(
    '/api/video',
    params
  );
  return data.video;
}
