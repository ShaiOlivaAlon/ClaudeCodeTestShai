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

/** Position + scale of a sculpture layer when composited over the background.
 *  x, y are normalised coordinates (0..1) of the sculpture's centre relative to the
 *  background canvas. scale is the sculpture's height as a fraction of the canvas height. */
export interface LayerTransform {
  x: number;
  y: number;
  scale: number;
}

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
  /** Position + scale over the background (sculpture layers only). */
  transform?: LayerTransform;
  /** True when the layer has been alpha-cut (transparent PNG). */
  isTransparent?: boolean;
}

// --- Reskin: bulk image-to-image with optional LoRAs ----------------------

export type ReskinLoraKind = 'file' | 'huggingface';

export interface ReskinLora {
  id: string;
  kind: ReskinLoraKind;
  /** For kind='file': original file name. */
  fileName?: string;
  /** For kind='file': data URL of the .safetensors. Uploaded to fal at run time. */
  fileDataUrl?: string;
  /** For kind='huggingface': repo id, e.g. "alvdansen/flux-koda". */
  huggingfaceId?: string;
  /** 0..2 (1 is default). */
  scale: number;
}

export type ReskinAssetStatus = 'idle' | 'queued' | 'generating' | 'done' | 'error';

/** A single source asset and its current reskin result. */
export interface ReskinAsset {
  id: string;
  fileName: string;
  width: number;
  height: number;
  sourceDataUrl: string;
  resultUrl?: string;
  status: ReskinAssetStatus;
  error?: string;
  /** Marked for the export ZIP / batch-animate pass. */
  selected: boolean;
  /** When animate has been kicked off on this asset's result. */
  videoUrl?: string;
  videoStatus?: GenerationStatus;
  videoError?: string;
}

export interface ReskinProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** What to re-render each asset into ("70s sci-fi pulp", "gold-foiled trading card"...). */
  prompt: string;
  /** 0..1, img-to-img strength (lower = closer to source, higher = closer to prompt). */
  strength: number;
  /** Image model id (must support img-to-img). */
  imageModel: string;
  /** Asset ids from the global library used as style references. */
  styleReferenceAssetIds: string[];
  loras: ReskinLora[];
  assets: ReskinAsset[];
  /** Video model to use for the Animate sub-tab. */
  videoModel?: string;
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

export type Provider = 'google' | 'anthropic' | 'fal' | 'openai' | 'azure-openai' | 'litellm' | 'runway';

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
