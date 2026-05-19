import type { Asset, Brief, Suggestion } from '../types';

export interface PromptInput {
  brief: Brief;
  assets: Asset[];
  selectedSuggestions: Suggestion[];
  aspect: string;
  titleForThisImage?: string; // optional single title to render
}

/**
 * Build a single prompt string that the model will use. Kept human-readable
 * so the artist can preview / tweak before sending.
 */
export function buildPrompt({
  brief,
  assets,
  selectedSuggestions,
  aspect,
  titleForThisImage,
}: PromptInput): string {
  const lines: string[] = [];

  lines.push(
    `Create a polished marketing creative for a Playtika casual mobile game. ` +
      `Aspect ratio: ${aspect}. Production-ready quality, crisp focal point, clear silhouette.`
  );

  if (brief.theme?.trim()) lines.push(`Theme: ${brief.theme.trim()}.`);
  if (brief.styles?.length) lines.push(`Style: ${brief.styles.join(', ')}.`);
  if (brief.seasons?.length) lines.push(`Seasonal: ${brief.seasons.join(', ')}.`);
  if (brief.features?.length)
    lines.push(`Format / use case: ${brief.features.join(', ')}.`);

  const hasChar = assets.some((a) => a.kind === 'character');
  const hasItem = assets.some((a) => a.kind === 'item');
  const hasLogo = assets.some((a) => a.kind === 'logo');
  const hasRef = assets.some((a) => a.kind === 'reference');

  if (hasChar)
    lines.push(
      'Use the reference characters faithfully — preserve identity, proportions, colors and outfit details.'
    );
  if (hasItem) lines.push('Feature the provided item(s) prominently and recognizably.');
  if (hasLogo)
    lines.push(
      'Place the game logo crisply with safe-area margin; do not stretch or recolor it.'
    );
  if (hasRef) lines.push('Match the mood, palette and lighting from the style references.');

  if (selectedSuggestions.length) {
    lines.push('Creative directions:');
    selectedSuggestions.forEach((s) => lines.push(`• ${s.label}`));
  }

  if (titleForThisImage?.trim()) {
    lines.push(
      `Render the headline "${titleForThisImage.trim()}" cleanly within the safe area — ` +
        `legible at thumbnail size, bold display typography, no spelling errors, no extra words.`
    );
  } else if (brief.titles?.length) {
    lines.push(
      `Leave a clear text-safe area for headlines such as: ${brief.titles
        .map((t) => `"${t}"`)
        .join(', ')}.`
    );
  }

  if (brief.copyExamples?.trim())
    lines.push(`Copy voice reference: ${brief.copyExamples.trim()}.`);
  if (brief.notes?.trim()) lines.push(`Additional notes: ${brief.notes.trim()}.`);

  lines.push(
    'Avoid: extra limbs, distorted faces, illegible text, watermarks, busy backgrounds that fight the focal point.'
  );

  return lines.join('\n');
}
