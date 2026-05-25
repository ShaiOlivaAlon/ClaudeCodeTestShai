import JSZip from 'jszip';
import type { GameProject } from '../types';
import { flattenComposite } from './utils';

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
  /** Normalised position + scale at which to composite this state over the background. */
  transform?: { x: number; y: number; scale: number };
  isTransparent?: boolean;
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

  // Sculpture states in order: index 0 is the full sculpture. We export each one twice:
  //   - sculpture-state-NN.png  : transparent PNG (the layer itself)
  //   - composite-state-NN.png  : sculpture pre-composited onto the background at the saved
  //                                position + scale, so a non-programmable game tool can pick
  //                                up the flat image and use it directly.
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
      transform: layer.transform,
      isTransparent: !!layer.isTransparent,
    });

    if (project.background?.imageUrl && layer.isTransparent) {
      try {
        const flatDataUrl = await flattenComposite({
          backgroundUrl: project.background.imageUrl,
          sculptureUrl: layer.imageUrl,
          transform: layer.transform,
          width: 1024,
        });
        const compFile = `composite-state-${num}.png`;
        zip.file(compFile, await (await fetch(flatDataUrl)).blob());
      } catch {
        // Non-fatal — the transparent PNG is still in the ZIP.
      }
    }
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
      `                              (includes per-state x/y/scale to composite the`,
      `                              transparent sculpture over the background)`,
      `  - background.*            — single background image`,
      `  - sculpture-state-NN.*    — TRANSPARENT PNG of the sculpture at each state`,
      `                              (use these in your engine + composite over the`,
      `                              background at the position from the manifest)`,
      `  - composite-state-NN.png  — pre-flattened sculpture-on-background at the`,
      `                              saved position + scale, for tools that need a`,
      `                              single image per state`,
      ``,
    ].join('\n'),
  );

  const blob = await zip.generateAsync({ type: 'blob' });
  const filename = `${safeFileName(project.name)}.zip`;
  return { blob, filename };
}
