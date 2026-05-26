export type ProviderId =
  | 'fal'
  | 'google'
  | 'runway'
  | 'litellm'
  | 'openai'
  | 'azure'
  | 'claude'
  | 'aws'
  | 'gcp';

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  capabilities: ('image' | 'video' | 'lora')[];
  /** Whether direct browser calls work (CORS-permitted). */
  browserDirect: boolean;
  /** Where the user gets the key. */
  docsUrl: string;
  /** Free-text endpoint hint when applicable. */
  endpointHint?: string;
}

export interface ApiKeys {
  fal?: string;
  google?: string;
  runway?: string;
  litellm?: string;
  litellmBase?: string;
  openai?: string;
  azure?: string;
  azureBase?: string;
  claude?: string;
  aws?: string;
  awsSecret?: string;
  awsRegion?: string;
  gcp?: string;
  gcpProject?: string;
}

export interface LoRA {
  id: string;
  name: string;
  url: string;
  scale: number;
}

/** One source image. Lives in IndexedDB; we keep metadata in app state. */
export interface Asset {
  id: string;
  /** Relative path inside the original folder, eg "ui/button_play.png". */
  path: string;
  name: string;
  width: number;
  height: number;
  mime: string;
  bytes: number;
  /** ObjectURL for previewing. Re-created from blob on load. */
  previewUrl: string;
}

/** A reskin output paired with its source. */
export interface ReskinResult {
  id: string;
  sourceId: string;
  /** Mirrors source.path so ZIP export preserves structure. */
  path: string;
  previewUrl: string;
  width: number;
  height: number;
  status: 'pending' | 'running' | 'done' | 'error';
  error?: string;
  providerId: ProviderId;
  model?: string;
  createdAt: number;
}

export interface AnimationResult {
  id: string;
  sourceId: string;
  path: string;
  videoUrl: string;
  posterUrl?: string;
  status: 'pending' | 'running' | 'done' | 'error';
  error?: string;
  providerId: ProviderId;
  model?: string;
  durationSec?: number;
  createdAt: number;
}

export interface StyleRef {
  id: string;
  name: string;
  /** ObjectURL for preview / data url for sending. */
  previewUrl: string;
  dataUrl: string;
  weight: number;
}

export interface ReskinSettings {
  prompt: string;
  negativePrompt: string;
  strength: number;
  guidance: number;
  steps: number;
  seed: number | null;
  providerId: ProviderId;
  model: string;
  loras: LoRA[];
  styleRefs: StyleRef[];
  /** Stretch outputs back to original dimensions when provider rounds. */
  preserveSize: boolean;
}

export interface AnimateSettings {
  prompt: string;
  providerId: ProviderId;
  model: string;
  durationSec: number;
  motionStrength: number;
}
