import type { Asset, AspectRatio } from '../types';

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Short hash of a (potentially huge) data URL — we only need uniqueness, not security. */
async function hashDataUrl(dataUrl: string): Promise<string> {
  // SHA-256 over the full string. WebCrypto digest is fast enough even for ~5MB data URLs.
  return sha256Hex(dataUrl);
}

export interface ImageCacheKeyInput {
  prompt: string;
  model: string;
  aspectRatio: AspectRatio;
  referenceAssetIds: string[];
  assets: Asset[];
  /** Inpaint-only inputs. */
  maskDataUrl?: string;
  sourceImageDataUrl?: string;
}

export async function imageCacheKey(input: ImageCacheKeyInput): Promise<string> {
  const refHashes = await Promise.all(
    input.referenceAssetIds
      .map((id) => input.assets.find((a) => a.id === id))
      .filter((a): a is Asset => Boolean(a))
      .map((a) => hashDataUrl(a.dataUrl)),
  );
  refHashes.sort();
  const maskHash = input.maskDataUrl ? await hashDataUrl(input.maskDataUrl) : '';
  const sourceHash = input.sourceImageDataUrl ? await hashDataUrl(input.sourceImageDataUrl) : '';
  const combined = [
    'img',
    input.model,
    input.aspectRatio,
    input.prompt.trim(),
    refHashes.join(','),
    maskHash,
    sourceHash,
  ].join('|');
  return sha256Hex(combined);
}

export interface VideoCacheKeyInput {
  prompt: string;
  model: string;
  aspectRatio: AspectRatio;
  sourceImageDataUrl: string;
}

export async function videoCacheKey(input: VideoCacheKeyInput): Promise<string> {
  const sourceHash = await hashDataUrl(input.sourceImageDataUrl);
  const combined = ['vid', input.model, input.aspectRatio, input.prompt.trim(), sourceHash].join('|');
  return sha256Hex(combined);
}
