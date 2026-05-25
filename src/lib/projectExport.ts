import JSZip from 'jszip';
import type { GameProject } from '../types';

async function dataUrlOrUrlToBlob(src: string): Promise<Blob> {
  if (src.startsWith('data:')) {
    // data URL → blob via fetch (works in all modern browsers).
    return (await fetch(src)).blob();
  }
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Could not fetch layer image (${res.status}).`);
  return res.blob();
}

function extOf(blob: Blob): string {
  if (blob.type.includes('jpeg')) return 'jpg';
  if (blob.type.includes('webp')) return 'webp';
  return 'png';
}

function safeFileName(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '') || 'project';
}

interface ManifestLayer {
  file: string;
  prompt: string;
  cutNote?: string;
  imageModel: string;
  createdAt: number;
}

export interface ProjectManifest {
  format: 'playtika-artist-studio.game-project.v1';
  name: string;
  createdAt: number;
  updatedAt: number;
  aspectRatio: string;
  material: string;
  sculptureSubject: string;
  background: ManifestLayer | null;
  /** Ordered from full sculpture (index 0) to most-reduced (last). */
  sculptureStates: ManifestLayer[];
}

/** Build a Blob containing the project as a ZIP: manifest.json + background.png +
 *  sculpture-state-N.png for each saved layer. */
export async function exportGameProjectZip(project: GameProject): Promise<{ blob: Blob; filename: string }> {
  const zip = new JSZip();
  const manifest: ProjectManifest = {
    format: 'playtika-artist-studio.game-project.v1',
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    aspectRatio: project.aspectRatio,
    material: project.material,
    sculptureSubject: project.sculptureSubject,
    background: null,
    sculptureStates: [],
  };

  if (project.background?.imageUrl) {
    const blob = await dataUrlOrUrlToBlob(project.background.imageUrl);
    const file = `background.${extOf(blob)}`;
    zip.file(file, blob);
    manifest.background = {
      file,
      prompt: project.background.prompt,
      imageModel: project.background.imageModel,
      createdAt: project.background.createdAt,
    };
  }

  // Layers in order: index 0 is the full sculpture.
  const ordered = [...project.sculptureLayers].sort((a, b) => a.index - b.index);
  for (const layer of ordered) {
    if (!layer.imageUrl) continue;
    const blob = await dataUrlOrUrlToBlob(layer.imageUrl);
    const num = String(layer.index + 1).padStart(2, '0');
    const file = `sculpture-state-${num}.${extOf(blob)}`;
    zip.file(file, blob);
    manifest.sculptureStates.push({
      file,
      prompt: layer.prompt,
      cutNote: layer.cutNote,
      imageModel: layer.imageModel,
      createdAt: layer.createdAt,
    });
  }

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  // A tiny README so a teammate opening the ZIP knows what it is.
  zip.file(
    'README.txt',
    [
      `Playtika Artist Studio — Game Project export`,
      ``,
      `Project: ${project.name}`,
      `Aspect ratio: ${project.aspectRatio}`,
      `Material: ${project.material}`,
      `Subject: ${project.sculptureSubject}`,
      ``,
      `Files:`,
      `  - manifest.json           — structured metadata for the game runtime`,
      `  - background.*            — single background image`,
      `  - sculpture-state-NN.*    — sculpture states, ordered from full (01) to`,
      `                              most-reduced. Cycle through these as the`,
      `                              player "cuts" pieces away.`,
      ``,
    ].join('\n'),
  );

  const blob = await zip.generateAsync({ type: 'blob' });
  const filename = `${safeFileName(project.name)}.zip`;
  return { blob, filename };
}
