export type AssetCategory = 'character' | 'item' | 'logo' | 'reference';

export interface Asset {
  id: string;
  category: AssetCategory;
  name: string;
  /** Optional short description the user can write so the prompt model knows what this asset is. */
  description?: string;
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
  /** The single seasonal context this idea was built around (one of brief.seasons). */
  chosenSeason?: string;
  /** The single primary theme this idea was built around (one of brief.themes). */
  chosenTheme?: string;
  /** The single primary visual style this idea was built around (one of brief.styles). */
  chosenStyle?: string;
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
  /** Mirrors of the suggestion's chosen-axis fields so the gallery can show them without joining. */
  chosenSeason?: string;
  chosenTheme?: string;
  chosenStyle?: string;
  /** When this generation was derived from another (inpaint / refinement), the source id. */
  parentId?: string;
  /** Set on inpaint results — short description of the edit ("hat -> wizard hat"). */
  editNote?: string;
}

/** A reusable brief configuration (no assets — those live in the library). */
export interface BriefPreset {
  id: string;
  name: string;
  /** Snapshot of the brief without selectedAssetIds (since asset ids are install-local). */
  brief: Omit<Brief, 'selectedAssetIds'>;
  createdAt: number;
}

// --- Game Feature: layered sculpture projects ------------------------------

export type GameLayerKind = 'background' | 'sculpture';

export type GameLayerStatus = 'queued' | 'generating' | 'done' | 'error';

export interface GameLayer {
  id: string;
  kind: GameLayerKind;
  /** For sculpture layers: 0 = full, increasing = progressively more removed. */
  index: number;
  imageUrl?: string;
  prompt: string;
  imageModel: string;
  status: GameLayerStatus;
  error?: string;
  createdAt: number;
  /** For sculpture layers >= 1: short description of the cut applied this step. */
  cutNote?: string;
}

/** A game-feature project: a background image + an ordered sequence of sculpture states. */
export interface GameProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  aspectRatio: AspectRatio;
  material: string;
  sculptureSubject: string;
  backgroundPrompt: string;
  background?: GameLayer;
  /** Ordered from full (index 0) to most-reduced (last). */
  sculptureLayers: GameLayer[];
}

export type Provider = 'google' | 'anthropic' | 'fal' | 'openai' | 'azure-openai';

export type Role = 'text' | 'image' | 'video';

export interface RoleKey {
  provider: Provider;
  key: string;
  /** Azure OpenAI only: resource endpoint, e.g. https://my-resource.openai.azure.com */
  endpoint?: string;
  /** Azure OpenAI only: deployment name (the user names this when they deploy a model). */
  deployment?: string;
  /** Azure OpenAI only: API version, e.g. 2024-10-21. */
  apiVersion?: string;
}

export interface ApiKeys {
  text?: RoleKey;
  image?: RoleKey;
  video?: RoleKey;
}

export interface Settings {
  apiKeys: ApiKeys;
  defaultTextModel: string;
  defaultImageModel: string;
  defaultVideoModel: string;
  /** True once the user has completed the initial setup wizard. */
  setupComplete: boolean;
}
