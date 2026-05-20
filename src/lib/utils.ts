import type { AspectRatio } from '../types';
import { ASPECT_RATIOS } from './models';

export function uid(prefix = 'id'): string {
  const r = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${r}`;
}

export function cls(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}

export async function imageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = dataUrl;
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(meta)?.[1] ?? 'application/octet-stream';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export function aspectRatioSize(ratio: AspectRatio, longSide = 1408): { width: number; height: number } {
  const ar = ASPECT_RATIOS.find((a) => a.id === ratio)!;
  if (ar.w >= ar.h) {
    return { width: longSide, height: Math.round((longSide * ar.h) / ar.w) };
  }
  return { width: Math.round((longSide * ar.w) / ar.h), height: longSide };
}

/** Fal "image_size" enum mapping for FLUX-family models. */
export function falImageSize(ratio: AspectRatio): string {
  switch (ratio) {
    case '1:1':  return 'square_hd';
    case '9:16': return 'portrait_16_9';
    case '16:9': return 'landscape_16_9';
    case '4:5':  return 'portrait_4_3';
    case '5:4':  return 'landscape_4_3';
    case '3:4':  return 'portrait_4_3';
    case '4:3':  return 'landscape_4_3';
    case '2:3':  return 'portrait_4_3';
    case '3:2':  return 'landscape_4_3';
    default:     return 'square_hd';
  }
}

/** Kling video aspect ratio enum. */
export function klingAspect(ratio: AspectRatio): '1:1' | '16:9' | '9:16' {
  if (ratio === '9:16' || ratio === '3:4' || ratio === '2:3' || ratio === '4:5') return '9:16';
  if (ratio === '16:9' || ratio === '4:3' || ratio === '5:4' || ratio === '3:2') return '16:9';
  return '1:1';
}

export async function downloadUrl(url: string, filename: string): Promise<void> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    const blob = await res.blob();
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(u);
  } catch {
    // Fallback: open in new tab
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return Promise.resolve();
}

export function shortText(s: string, max = 90): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}
