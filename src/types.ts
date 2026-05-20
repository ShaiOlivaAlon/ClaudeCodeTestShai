export type AssetCategory = 'character' | 'item' | 'logo' | 'reference';

export interface Asset {
  id: string;
  category: AssetCategory;
  name: string;
  dataUrl: string;
  width: number;
  height: number;
  createdAt: number;
}

export type AspectRatio =
  | '1:1' | '9:16' | '16:9' | '4:5' | '5:4' | '3:4' | '4:3' | '2:3' | '3:2';

export interface Brief {
  selectedAssetIds: string[];
  aspectRatios: AspectRatio[];
  seasons: string[];
  themes: string[];
  styles: string[];
  features: string[];
  textExamples: string[];
  titles: string[];
  notes: string;
  variationCount: number;
  textModel: string;
  imageModel: string;
  videoModel: string;
}

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  prompt: string;
  tags: string[];
  selected: boolean;
}

export type GenerationStatus = 'queued' | 'generating' | 'done' | 'error';

export interface VideoGeneration {
  status: GenerationStatus;
  url?: string;
  model: string;
  prompt: string;
  error?: string;
}

export interface Generation {
  id: string;
  suggestionId?: string;
  title: string;
  prompt: string;
  enhancedPrompt: string;
  imageUrl?: string;
  aspectRatio: AspectRatio;
  imageModel: string;
  status: GenerationStatus;
  error?: string;
  createdAt: number;
  video?: VideoGeneration;
  /** Asset ids used as references for this generation. */
  referenceAssetIds: string[];
}

export interface ApiKeys {
  anthropic?: string;
  openai?: string;
  fal?: string;
}

export interface Settings {
  apiKeys: ApiKeys;
  defaultTextModel: string;
  defaultImageModel: string;
  defaultVideoModel: string;
  /** True once the user has completed the initial setup wizard. */
  setupComplete: boolean;
}
