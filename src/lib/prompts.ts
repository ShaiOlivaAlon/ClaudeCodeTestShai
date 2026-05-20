import type { Asset, Brief, Suggestion } from '../types';

export interface BriefForLLM {
  brief: Brief;
  characters: Asset[];
  items: Asset[];
  logos: Asset[];
  references: Asset[];
}

export function buildSuggestionSystemPrompt(): string {
  return [
    'You are a senior marketing art director at Playtika, a leading mobile games company.',
    'You create concise, vivid prompt-briefs for generating finalized marketing visuals (pop-ups, ads, social posts, store creatives) for Playtika games.',
    'Your job: take a creative brief and return a diverse set of distinct concept ideas the artist can multi-select from.',
    'Constraints:',
    '- Each idea must be a complete, generation-ready image prompt (one paragraph).',
    '- Each idea must respect provided characters, items, logos, themes, styles, season, features, and required title text.',
    '- Vary composition, mood, camera, and hook across ideas — do not repeat.',
    '- Prefer high-impact mobile-game marketing aesthetics: bold focal subject, clear hierarchy, dramatic light, strong silhouettes.',
    '- If a title or text must appear, include it verbatim in quotes inside the prompt.',
    '- Avoid: extra hands, distorted faces, text artifacts, overcrowded composition.',
    'You MUST reply with a single JSON object matching the schema, no prose, no markdown fences.',
  ].join('\n');
}

export function buildSuggestionUserPrompt(input: BriefForLLM): string {
  const { brief, characters, items, logos, references } = input;
  const lines: string[] = [];
  lines.push(`Generate ${Math.max(3, Math.min(24, brief.variationCount))} distinct concept ideas.`);
  lines.push('');
  lines.push('CREATIVE BRIEF');
  if (characters.length) lines.push(`Characters: ${characters.map((c) => c.name).join(', ')}`);
  if (items.length) lines.push(`Items / props: ${items.map((c) => c.name).join(', ')}`);
  if (logos.length) lines.push(`Game logos to feature: ${logos.map((c) => c.name).join(', ')}`);
  if (references.length) lines.push(`Style references: ${references.map((c) => c.name).join(', ')}`);
  if (brief.seasons.length) lines.push(`Seasonal / periodic context: ${brief.seasons.join(', ')}`);
  if (brief.themes.length) lines.push(`Themes: ${brief.themes.join(', ')}`);
  if (brief.styles.length) lines.push(`Visual styles: ${brief.styles.join(', ')}`);
  if (brief.features.length) lines.push(`Required visual features: ${brief.features.join(', ')}`);
  if (brief.textExamples.length) lines.push(`Tone / copy examples: ${brief.textExamples.map((t) => `"${t}"`).join(', ')}`);
  if (brief.titles.length) lines.push(`MUST-APPEAR title text on the image (verbatim, in quotes): ${brief.titles.map((t) => `"${t}"`).join(' / ')}`);
  if (brief.aspectRatios.length) lines.push(`Target aspect ratios: ${brief.aspectRatios.join(', ')}`);
  if (brief.notes.trim()) lines.push(`Additional notes: ${brief.notes.trim()}`);
  lines.push('');
  lines.push('OUTPUT JSON SCHEMA');
  lines.push('{');
  lines.push('  "ideas": [');
  lines.push('    {');
  lines.push('      "title": "short evocative name (max 6 words)",');
  lines.push('      "description": "one short sentence explaining the hook for the artist",');
  lines.push('      "prompt": "complete image-generation prompt, one rich paragraph, include required text verbatim in quotes if any",');
  lines.push('      "tags": ["2-4 short tags"]');
  lines.push('    }');
  lines.push('  ]');
  lines.push('}');
  return lines.join('\n');
}

export function buildImagePromptEnhancer(): string {
  return [
    'You rewrite a single image-generation prompt to be production-ready for marketing creatives.',
    'Make it sharp, vivid, and unambiguous. Keep any quoted title text verbatim and instruct the model to render it cleanly.',
    'Output ONLY the rewritten prompt as a single paragraph. No commentary.',
  ].join('\n');
}

export function buildAnimatePromptHint(suggestion: Pick<Suggestion, 'title' | 'description' | 'prompt'>): string {
  return [
    `Animate this still: ${suggestion.title}.`,
    'Add subtle but exciting motion: gentle camera push-in, parallax on background elements, sparkles drifting, character idle micro-motions, lights flickering, particles flowing.',
    'Avoid heavy scene changes; keep the subject and composition stable. Cinematic, 24fps feel.',
    `Concept: ${suggestion.description}`,
  ].join(' ');
}
