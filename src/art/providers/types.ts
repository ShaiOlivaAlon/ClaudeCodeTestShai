import { Asset, LoRA, StyleRef, ApiKeys } from '../types';

export interface ImageGenInput {
  source: Asset;
  /** Original source image as data URL, fetched fresh from IndexedDB. */
  sourceDataUrl: string;
  prompt: string;
  negativePrompt: string;
  strength: number;
  guidance: number;
  steps: number;
  seed: number | null;
  model: string;
  loras: LoRA[];
  styleRefs: StyleRef[];
  width: number;
  height: number;
}

export interface ImageGenOutput {
  /** Final image as object URL (already resized to original dims if requested). */
  previewUrl: string;
  width: number;
  height: number;
}

export interface VideoGenInput {
  source: Asset;
  sourceDataUrl: string;
  prompt: string;
  model: string;
  durationSec: number;
  motionStrength: number;
}

export interface VideoGenOutput {
  videoUrl: string;
  posterUrl?: string;
  durationSec?: number;
}

export interface TextToImageInput {
  prompt: string;
  negativePrompt: string;
  guidance: number;
  steps: number;
  seed: number | null;
  model: string;
  loras: LoRA[];
  styleRefs: StyleRef[];
  width: number;
  height: number;
}

export interface ImageProvider {
  generate(input: ImageGenInput, keys: ApiKeys): Promise<ImageGenOutput>;
}

export interface TextToImageProvider {
  generate(input: TextToImageInput, keys: ApiKeys): Promise<ImageGenOutput>;
}

export interface VideoProvider {
  generate(input: VideoGenInput, keys: ApiKeys): Promise<VideoGenOutput>;
}

export class ProviderError extends Error {
  constructor(message: string, public providerId: string) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class RequiresProxyError extends ProviderError {
  constructor(providerId: string) {
    super(
      `${providerId} blocks direct browser calls (CORS). Run a relay server and ` +
        `configure it to forward requests, or pick a browser-compatible provider ` +
        `(FAL.AI, Google AI Studio, Runway, or LiteLLM).`,
      providerId
    );
    this.name = 'RequiresProxyError';
  }
}
