import type { AspectRatio } from '../types';

export interface ModelDef {
  id: string;
  name: string;
  provider: 'anthropic' | 'fal' | 'openai';
  description?: string;
  /** If true, this image model accepts a reference image (character / IP consistency). */
  supportsReference?: boolean;
  /** If true, this model is known to render embedded titles/text reliably. */
  supportsText?: boolean;
}

export const TEXT_MODELS: ModelDef[] = [
  { id: 'claude-opus-4-7',    name: 'Claude Opus 4.7',    provider: 'anthropic', description: 'Most capable — deepest concept exploration.' },
  { id: 'claude-sonnet-4-6',  name: 'Claude Sonnet 4.6',  provider: 'anthropic', description: 'Balanced speed and creativity (default).' },
  { id: 'claude-haiku-4-5',   name: 'Claude Haiku 4.5',   provider: 'anthropic', description: 'Fastest — quick brainstorming.' },
];

export const IMAGE_MODELS: ModelDef[] = [
  { id: 'fal-ai/flux-pro/v1.1-ultra', name: 'FLUX 1.1 Pro Ultra', provider: 'fal', description: 'Top-tier quality, slower.' },
  { id: 'fal-ai/flux-pro/v1.1',       name: 'FLUX 1.1 Pro',       provider: 'fal', description: 'Sharp marketing-grade output.' },
  { id: 'fal-ai/flux/dev',            name: 'FLUX Dev',           provider: 'fal', description: 'Fast iterations.' },
  { id: 'fal-ai/flux-pulid',          name: 'FLUX + Character',   provider: 'fal', description: 'Keeps character identity from a reference.', supportsReference: true },
  { id: 'fal-ai/flux/dev/image-to-image', name: 'FLUX Img-to-Img', provider: 'fal', description: 'Re-styles a reference frame.', supportsReference: true },
  { id: 'fal-ai/ideogram/v2',         name: 'Ideogram v2',        provider: 'fal', description: 'Best for embedded title text.', supportsText: true },
  { id: 'fal-ai/recraft-v3',          name: 'Recraft v3',         provider: 'fal', description: 'Vector & illustration styles.' },
  { id: 'openai/gpt-image-1',         name: 'GPT Image 1',        provider: 'openai', description: 'OpenAI native, supports text + refs.', supportsReference: true, supportsText: true },
];

export const VIDEO_MODELS: ModelDef[] = [
  { id: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video', name: 'Kling 2.5 Turbo Pro', provider: 'fal', description: 'High-motion 5–10s clips.' },
  { id: 'fal-ai/kling-video/v1.6/standard/image-to-video',  name: 'Kling 1.6 Standard',  provider: 'fal', description: 'Cheaper, decent motion.' },
  { id: 'fal-ai/runway-gen3/turbo/image-to-video',          name: 'Runway Gen-3 Turbo',  provider: 'fal', description: 'Cinematic camera moves.' },
  { id: 'fal-ai/luma-dream-machine',                        name: 'Luma Dream Machine',  provider: 'fal', description: 'Dreamy, painterly motion.' },
  { id: 'fal-ai/veo3/fast/image-to-video',                  name: 'Veo 3 Fast',          provider: 'fal', description: 'Photoreal motion.' },
];

export const ASPECT_RATIOS: { id: AspectRatio; label: string; w: number; h: number; use: string }[] = [
  { id: '1:1',  label: '1:1',  w: 1,  h: 1,  use: 'Square — Instagram, store icon' },
  { id: '9:16', label: '9:16', w: 9,  h: 16, use: 'Vertical — Story, Reel, TikTok' },
  { id: '16:9', label: '16:9', w: 16, h: 9,  use: 'Landscape — banner, YouTube' },
  { id: '4:5',  label: '4:5',  w: 4,  h: 5,  use: 'Instagram feed portrait' },
  { id: '5:4',  label: '5:4',  w: 5,  h: 4,  use: 'Slight landscape' },
  { id: '3:4',  label: '3:4',  w: 3,  h: 4,  use: 'Portrait — pop-ups' },
  { id: '4:3',  label: '4:3',  w: 4,  h: 3,  use: 'Classic landscape' },
  { id: '2:3',  label: '2:3',  w: 2,  h: 3,  use: 'Tall portrait — posters' },
  { id: '3:2',  label: '3:2',  w: 3,  h: 2,  use: 'Wide landscape' },
];

export const SEASONS = [
  "New Year", "Lunar New Year", "Valentine's Day", "St. Patrick's Day",
  "Easter", "Spring", "Mother's Day", "Father's Day", "Summer",
  '4th of July', 'Back to School', 'Halloween', 'Autumn', 'Thanksgiving',
  'Black Friday', 'Christmas', 'Winter', 'Diwali', 'Ramadan',
  'Pride', 'Anniversary', 'Birthday',
];

export const PRESET_THEMES = [
  'Adventure', 'Fantasy', 'Action', 'Mystery', 'Cute', 'Epic', 'Comedy',
  'Heroic', 'Cozy', 'Magical', 'Spooky', 'Festive', 'Romantic', 'Tropical',
  'Underwater', 'Outer space', 'Wild west', 'Ancient', 'Cyberpunk', 'Steampunk',
];

export const PRESET_STYLES = [
  '3D render', 'Stylized illustration', 'Cartoon', 'Anime', 'Photo-realistic',
  'Pixel art', 'Vector', 'Watercolor', 'Comic book', 'Low-poly',
  'Isometric', 'Flat design', 'Concept art', 'Sticker sheet',
  'Mobile game UI', 'Slot art', 'Casino art', 'Premium glossy', 'Painterly',
];

export const PRESET_FEATURES = [
  'Coin burst', 'Confetti', 'Fireworks', 'Glow', 'Sparkles',
  'Lightning', 'Smoke', 'Magic dust', 'Lens flare', 'Energy aura',
  'Speed lines', 'Particles', 'Treasure pile', 'Jackpot', 'Spin wheel',
  'Bold typography', 'CTA button', 'Discount badge', 'Sale tag',
  'Limited-time banner', 'Drop shadow', 'Vignette',
];

export function findModel(list: ModelDef[], id: string): ModelDef | undefined {
  return list.find((m) => m.id === id);
}

export function getAspectRatio(id: AspectRatio) {
  return ASPECT_RATIOS.find((a) => a.id === id) ?? ASPECT_RATIOS[0];
}
