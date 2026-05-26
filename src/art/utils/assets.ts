import { Asset } from '../types';
import { putSource } from './storage';

const IMAGE_MIME = /^image\/(png|jpe?g|webp|gif|bmp|avif)$/i;
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|avif)$/i;

function isImage(file: File | { name: string; type?: string }): boolean {
  if (file.type && IMAGE_MIME.test(file.type)) return true;
  return IMAGE_EXT.test(file.name);
}

export function newId(): string {
  return crypto.randomUUID();
}

/** Read width/height from an image blob via an Image element. */
export function probeDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      URL.revokeObjectURL(url);
      resolve({ width: w, height: h });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to read image dimensions'));
    };
    img.src = url;
  });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Recursively walk a directory selected via input.webkitdirectory. */
export async function filesFromInput(input: HTMLInputElement): Promise<{ file: File; relativePath: string }[]> {
  const out: { file: File; relativePath: string }[] = [];
  if (!input.files) return out;
  for (const file of Array.from(input.files)) {
    const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    if (isImage(file)) out.push({ file, relativePath: path });
  }
  return out;
}

interface FileSystemEntryLike {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
  file?(cb: (f: File) => void, err?: (e: Error) => void): void;
  createReader?(): { readEntries(cb: (entries: FileSystemEntryLike[]) => void): void };
}

/** Walk a DataTransfer drop, recursing into directories. */
export async function filesFromDrop(dt: DataTransfer): Promise<{ file: File; relativePath: string }[]> {
  const out: { file: File; relativePath: string }[] = [];
  const items = Array.from(dt.items);
  await Promise.all(
    items.map(async (item) => {
      const entry = (item as DataTransferItem & {
        webkitGetAsEntry?: () => FileSystemEntryLike | null;
      }).webkitGetAsEntry?.();
      if (entry) {
        await walkEntry(entry, '', out);
      } else if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file && isImage(file)) out.push({ file, relativePath: file.name });
      }
    })
  );
  return out;
}

async function walkEntry(
  entry: FileSystemEntryLike,
  prefix: string,
  out: { file: File; relativePath: string }[]
): Promise<void> {
  if (entry.isFile && entry.file) {
    const file = await new Promise<File>((res, rej) => entry.file!(res, rej));
    const path = prefix ? `${prefix}/${file.name}` : file.name;
    if (isImage(file)) out.push({ file, relativePath: path });
  } else if (entry.isDirectory && entry.createReader) {
    const reader = entry.createReader();
    const children: FileSystemEntryLike[] = await new Promise((res) => {
      const all: FileSystemEntryLike[] = [];
      const readBatch = () => {
        reader.readEntries((entries) => {
          if (entries.length === 0) {
            res(all);
          } else {
            all.push(...entries);
            readBatch();
          }
        });
      };
      readBatch();
    });
    const nextPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
    for (const child of children) {
      await walkEntry(child, nextPrefix, out);
    }
  }
}

export async function ingestFiles(
  files: { file: File; relativePath: string }[]
): Promise<Asset[]> {
  const assets: Asset[] = [];
  for (const { file, relativePath } of files) {
    const { width, height } = await probeDimensions(file).catch(() => ({ width: 0, height: 0 }));
    if (!width || !height) continue;
    const id = newId();
    await putSource(id, file);
    assets.push({
      id,
      path: relativePath,
      name: file.name,
      width,
      height,
      mime: file.type || 'image/png',
      bytes: file.size,
      previewUrl: URL.createObjectURL(file),
    });
  }
  return assets;
}

/** Resize an image (object URL or data URL) to a target size using canvas. */
export async function resizeToDimensions(
  src: string,
  width: number,
  height: number
): Promise<Blob> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = src;
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error('Failed to load image for resize'));
  });
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(img, 0, 0, width, height);
  return new Promise((res, rej) => {
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error('Canvas toBlob returned null'))),
      'image/png',
      0.95
    );
  });
}
