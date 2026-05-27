import type { Asset, Brief, BrandGuard, Suggestion } from '../types';

export interface BriefForLLM {
  brief: Brief;
  characters: Asset[];
  items: Asset[];
  logos: Asset[];
  references: Asset[];
  brandGuard?: BrandGuard;
}

function brandGuardLines(g: BrandGuard | undefined): string[] {
  if (!g || !g.enabled) return [];
  const parts: string[] = ['', 'BRAND GUARD (must be honoured across every idea):'];
  if (g.colors.length)   parts.push(`- Brand palette to favour: ${g.colors.join(', ')}`);
  if (g.required.length) parts.push(`- Required: ${g.required.map((s) => `"${s}"`).join('; ')}`);
  if (g.banned.length)   parts.push(`- Forbidden (never include): ${g.banned.map((s) => `"${s}"`).join('; ')}`);
  return parts.length > 2 ? parts : [];
}

export function buildSuggestionSystemPrompt(): string {
  return [
    'You are a senior marketing art director at Playtika, a leading mobile games company.',
    'You create concise, vivid prompt-briefs for generating finalized marketing visuals (pop-ups, ads, social posts, store creatives) for Playtika games.',
    'Your job: take a creative brief and return a diverse set of distinct concept ideas the artist can multi-select from.',
    '',
    'CRITICAL — axis selection per idea:',
    '- For each idea you generate, deliberately PICK exactly ONE seasonal/period context (from the brief\'s seasons list, if any), ONE primary theme, and ONE primary visual style. Do NOT mash multiple seasons or themes into one image.',
    '- Across the full set of ideas, ROTATE through the supplied seasons/themes/styles so each combination gets explored. If there are more ideas than combinations, you may repeat — but no single idea may blend more than one season / theme / style.',
    '- Required features / FX may be combined freely within an idea (lighting, sparkles, badges, etc.).',
    '',
    'Constraints:',
    '- Each idea must be a complete, generation-ready image prompt (one paragraph).',
    '- Each idea must respect provided characters, items, logos, and required title text.',
    '- Vary composition, mood, camera, and hook across ideas — do not repeat.',
    '- Prefer high-impact mobile-game marketing aesthetics: bold focal subject, clear hierarchy, dramatic light, strong silhouettes.',
    '- If a title or text must appear, include it verbatim in quotes inside the prompt.',
    '- Avoid: extra hands, distorted faces, text artifacts, overcrowded composition.',
    '',
    'You MUST reply with a single JSON object matching the schema, no prose, no markdown fences.',
  ].join('\n');
}

function describeAsset(a: Asset): string {
  return a.description?.trim() ? `${a.name} — ${a.description.trim()}` : a.name;
}

export function buildSuggestionUserPrompt(input: BriefForLLM): string {
  const { brief, characters, items, logos, references } = input;
  const lines: string[] = [];
  const count = Math.max(3, Math.min(24, brief.variationCount));
  lines.push(`Generate ${count} distinct concept ideas.`);
  lines.push('');
  if (brief.mainPrompt?.trim()) {
    lines.push('PRIMARY BRIEF (highest priority — every idea should honour this direction):');
    lines.push(brief.mainPrompt.trim());
    lines.push('');
  }
  lines.push('CREATIVE BRIEF');
  if (characters.length) lines.push(`Characters: ${characters.map(describeAsset).join(' | ')}`);
  if (items.length) lines.push(`Items / props: ${items.map(describeAsset).join(' | ')}`);
  if (logos.length) lines.push(`Game logos to feature: ${logos.map(describeAsset).join(' | ')}`);
  if (references.length) lines.push(`Style references: ${references.map(describeAsset).join(' | ')}`);
  lines.push('');
  lines.push('AXES — each idea picks ONE from each list (if list non-empty):');
  if (brief.seasons.length) lines.push(`Seasons / periods (rotate across ideas): ${brief.seasons.join(' | ')}`);
  if (brief.themes.length)  lines.push(`Themes (pick one per idea): ${brief.themes.join(' | ')}`);
  if (brief.styles.length)  lines.push(`Visual styles (pick one per idea): ${brief.styles.join(' | ')}`);
  lines.push('');
  if (brief.features.length) lines.push(`Required visual features / FX (combine freely): ${brief.features.join(', ')}`);
  if (brief.textExamples.length) lines.push(`Tone / copy examples: ${brief.textExamples.map((t) => `"${t}"`).join(', ')}`);
  if (brief.titles.length) lines.push(`MUST-APPEAR title text on the image (verbatim, in quotes): ${brief.titles.map((t) => `"${t}"`).join(' / ')}`);
  if (brief.aspectRatios.length) lines.push(`Target aspect ratios: ${brief.aspectRatios.join(', ')}`);
  if (brief.notes.trim()) lines.push(`Additional notes: ${brief.notes.trim()}`);
  if (brief.negativePrompt?.trim()) lines.push(`AVOID at all costs: ${brief.negativePrompt.trim()}`);
  for (const l of brandGuardLines(input.brandGuard)) lines.push(l);
  lines.push('');
  lines.push('OUTPUT JSON SCHEMA');
  lines.push('{');
  lines.push('  "ideas": [');
  lines.push('    {');
  lines.push('      "title": "short evocative name (max 6 words)",');
  lines.push('      "description": "one short sentence explaining the hook for the artist",');
  lines.push('      "prompt": "complete image-generation prompt, one rich paragraph, include required text verbatim in quotes if any",');
  lines.push('      "chosenSeason": "exact value picked from the seasons list, or empty string if none",');
  lines.push('      "chosenTheme":  "exact value picked from the themes list, or empty string if none",');
  lines.push('      "chosenStyle":  "exact value picked from the visual styles list, or empty string if none",');
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

export function buildSocialCopySystemPrompt(): string {
  return [
    'You are a senior social-media copywriter for a mobile gaming company.',
    'Given the description of a single marketing image, write platform-tuned captions and hashtag sets.',
    'Each caption should be punchy, native to its platform, and end with a clear CTA when natural.',
    '',
    'You MUST reply with a single JSON object matching the schema, no prose, no markdown fences.',
  ].join('\n');
}

export function buildSocialCopyUserPrompt(opts: { title: string; prompt: string; description?: string }): string {
  return [
    `IMAGE TITLE: ${opts.title}`,
    `IMAGE PROMPT: ${opts.prompt}`,
    opts.description ? `EXTRA CONTEXT: ${opts.description}` : '',
    '',
    'For each of TikTok, Instagram, Facebook, X — write 3 caption variants (each ≤ 220 chars; TikTok ≤ 150; X ≤ 240) and 6-10 hashtags that fit that platform\'s tone.',
    '',
    'OUTPUT JSON SCHEMA',
    '{',
    '  "byPlatform": {',
    '    "tiktok":    { "captions": ["…","…","…"], "hashtags": ["#…","#…"] },',
    '    "instagram": { "captions": ["…","…","…"], "hashtags": ["#…","#…"] },',
    '    "facebook":  { "captions": ["…","…","…"], "hashtags": ["#…","#…"] },',
    '    "x":         { "captions": ["…","…","…"], "hashtags": ["#…","#…"] }',
    '  }',
    '}',
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
