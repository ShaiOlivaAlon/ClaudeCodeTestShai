import JSZip from 'jszip';
import type { ReskinProject } from '../types';

async function urlToBlob(src: string): Promise<Blob> {
  if (src.startsWith('data:')) return (await fetch(src)).blob();
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Could not fetch result (${res.status}).`);
  return res.blob();
}

function safeFileName(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9-_.]+/g, '-').replace(/^-+|-+$/g, '') || 'project';
}

function ext(blob: Blob, fallback = 'png'): string {
  if (blob.type.includes('jpeg')) return 'jpg';
  if (blob.type.includes('webp')) return 'webp';
  if (blob.type.includes('png'))  return 'png';
  return fallback;
}

/** Export every reskinned (and optionally selected) asset as a ZIP, preserving the
 *  original filename + dimensions. Also includes any animated MP4s and a manifest. */
export async function exportReskinProjectZip(project: ReskinProject, onlySelected = false): Promise<{ blob: Blob; filename: string }> {
  const zip = new JSZip();

  const reskinFolder = zip.folder('reskinned')!;
  const videoFolder = zip.folder('videos')!;
  const sourceFolder = zip.folder('source')!;

  const entries: any[] = [];
  for (const asset of project.assets) {
    if (onlySelected && !asset.selected) continue;
    const baseName = asset.fileName.replace(/\.[^.]+$/, '');

    // Always keep the original source for reference.
    const srcBlob = await urlToBlob(asset.sourceDataUrl);
    sourceFolder.file(asset.fileName, srcBlob);

    let reskinFile: string | undefined;
    if (asset.resultUrl) {
      const blob = await urlToBlob(asset.resultUrl);
      reskinFile = `${baseName}.${ext(blob)}`;
      reskinFolder.file(reskinFile, blob);
    }

    let videoFile: string | undefined;
    if (asset.videoUrl) {
      try {
        const blob = await urlToBlob(asset.videoUrl);
        videoFile = `${baseName}.mp4`;
        videoFolder.file(videoFile, blob);
      } catch {
        /* video fetch can fail when the URL has expired — skip silently */
      }
    }

    entries.push({
      id: asset.id,
      source: `source/${asset.fileName}`,
      reskinned: reskinFile ? `reskinned/${reskinFile}` : null,
      video: videoFile ? `videos/${videoFile}` : null,
      width: asset.width,
      height: asset.height,
      selected: asset.selected,
      status: asset.status,
    });
  }

  zip.file(
    'manifest.json',
    JSON.stringify({
      format: 'playtika-artist-studio.reskin-project.v1',
      name: project.name,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      prompt: project.prompt,
      strength: project.strength,
      imageModel: project.imageModel,
      videoModel: project.videoModel ?? null,
      loras: project.loras.map((l) => ({
        kind: l.kind,
        scale: l.scale,
        fileName: l.fileName ?? null,
        huggingfaceId: l.huggingfaceId ?? null,
      })),
      assets: entries,
    }, null, 2),
  );

  zip.file('README.txt', [
    'Playtika Artist Studio — Reskin project export',
    '',
    `Project: ${project.name}`,
    `Prompt:  ${project.prompt}`,
    `Model:   ${project.imageModel}    Strength: ${project.strength}`,
    '',
    'Folders:',
    '  source/      — the original assets you uploaded',
    '  reskinned/   — the regenerated versions (same dimensions as source)',
    '  videos/      — animated MP4s for assets you animated',
    '  manifest.json — structured map of source ↔ reskinned ↔ video',
    '',
  ].join('\n'));

  const blob = await zip.generateAsync({ type: 'blob' });
  return { blob, filename: `${safeFileName(project.name)}-reskin.zip` };
}
