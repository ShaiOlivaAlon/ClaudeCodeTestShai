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

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = src.startsWith('data:') ? '' : 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = src;
  });
}

/** Composite a (potentially transparent) image onto a solid colour and return a PNG data URL.
 *  Useful when feeding a transparent layer into APIs that expect an opaque image (e.g. inpaint). */
export async function compositeOnSolid(src: string, color = '#ffffff'): Promise<string> {
  const img = await loadImageElement(src);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/png');
}

/** Composite a transparent sculpture over a background image at the given normalised transform
 *  (x, y in 0..1 of the canvas; scale = sculpture height as fraction of canvas height). Returns a
 *  PNG data URL of the flattened result. */
export async function flattenComposite(opts: {
  backgroundUrl: string;
  sculptureUrl?: string;
  transform?: { x: number; y: number; scale: number };
  /** Final width in pixels. Height is derived from the background's aspect ratio. */
  width?: number;
}): Promise<string> {
  const bg = await loadImageElement(opts.backgroundUrl);
  const targetW = opts.width ?? bg.naturalWidth;
  const targetH = Math.round(targetW * (bg.naturalHeight / bg.naturalWidth));
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bg, 0, 0, targetW, targetH);
  if (opts.sculptureUrl) {
    const sc = await loadImageElement(opts.sculptureUrl);
    const t = opts.transform ?? { x: 0.5, y: 0.5, scale: 0.8 };
    const scHeight = targetH * t.scale;
    const scWidth = scHeight * (sc.naturalWidth / sc.naturalHeight);
    const cx = t.x * targetW;
    const cy = t.y * targetH;
    ctx.drawImage(sc, cx - scWidth / 2, cy - scHeight / 2, scWidth, scHeight);
  }
  return canvas.toDataURL('image/png');
}
