import {
  ImageProvider,
  VideoProvider,
  ImageGenInput,
  ImageGenOutput,
  VideoGenInput,
  VideoGenOutput,
  ProviderError,
} from './types';
import { ApiKeys } from '../types';

const QUEUE_BASE = 'https://queue.fal.run';

function authHeader(keys: ApiKeys): Record<string, string> {
  if (!keys.fal) throw new ProviderError('FAL.AI key missing', 'fal');
  return {
    Authorization: `Key ${keys.fal}`,
    'Content-Type': 'application/json',
  };
}

interface QueueSubmitResponse {
  request_id: string;
  status_url: string;
  response_url: string;
}

interface QueueStatusResponse {
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'ERROR' | string;
  logs?: { message: string }[];
}

async function submit(model: string, body: unknown, keys: ApiKeys): Promise<QueueSubmitResponse> {
  const url = `${QUEUE_BASE}/${model}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: authHeader(keys),
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new ProviderError(`FAL submit failed (${r.status}): ${text}`, 'fal');
  }
  return r.json();
}

async function poll<T>(statusUrl: string, responseUrl: string, keys: ApiKeys): Promise<T> {
  const start = Date.now();
  const TIMEOUT = 1000 * 60 * 10;
  while (Date.now() - start < TIMEOUT) {
    const r = await fetch(statusUrl, { headers: { Authorization: `Key ${keys.fal}` } });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      throw new ProviderError(`FAL status failed (${r.status}): ${text}`, 'fal');
    }
    const status: QueueStatusResponse = await r.json();
    if (status.status === 'COMPLETED') {
      const final = await fetch(responseUrl, { headers: { Authorization: `Key ${keys.fal}` } });
      if (!final.ok) {
        throw new ProviderError(`FAL response fetch failed (${final.status})`, 'fal');
      }
      return final.json() as Promise<T>;
    }
    if (status.status === 'ERROR') {
      const msg = status.logs?.map((l) => l.message).join('\n') ?? 'unknown';
      throw new ProviderError(`FAL job failed: ${msg}`, 'fal');
    }
    await new Promise((res) => setTimeout(res, 1500));
  }
  throw new ProviderError('FAL job timed out', 'fal');
}

async function fetchAsObjectUrl(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new ProviderError(`Failed to fetch result image (${r.status})`, 'fal');
  const blob = await r.blob();
  return URL.createObjectURL(blob);
}

interface FalImageResult {
  images?: { url: string; width?: number; height?: number }[];
  image?: { url: string; width?: number; height?: number };
}

interface FalVideoResult {
  video?: { url: string };
}

export const falImage: ImageProvider = {
  async generate(input: ImageGenInput, keys: ApiKeys): Promise<ImageGenOutput> {
    const body: Record<string, unknown> = {
      prompt: input.prompt,
      image_url: input.sourceDataUrl,
      strength: input.strength,
      num_inference_steps: input.steps,
      guidance_scale: input.guidance,
      image_size: { width: input.width, height: input.height },
    };
    if (input.negativePrompt) body.negative_prompt = input.negativePrompt;
    if (input.seed !== null) body.seed = input.seed;
    if (input.loras.length && input.model.includes('lora')) {
      body.loras = input.loras.map((l) => ({ path: l.url, scale: l.scale }));
    }
    if (input.styleRefs.length) {
      body.image_prompt = input.styleRefs[0].dataUrl;
      body.image_prompt_strength = input.styleRefs[0].weight;
    }

    const submission = await submit(input.model, body, keys);
    const result = await poll<FalImageResult>(submission.status_url, submission.response_url, keys);
    const imgUrl = result.images?.[0]?.url ?? result.image?.url;
    if (!imgUrl) throw new ProviderError('FAL returned no image URL', 'fal');
    const objectUrl = await fetchAsObjectUrl(imgUrl);
    return {
      previewUrl: objectUrl,
      width: result.images?.[0]?.width ?? input.width,
      height: result.images?.[0]?.height ?? input.height,
    };
  },
};

export const falVideo: VideoProvider = {
  async generate(input: VideoGenInput, keys: ApiKeys): Promise<VideoGenOutput> {
    const body: Record<string, unknown> = {
      prompt: input.prompt,
      image_url: input.sourceDataUrl,
      duration: `${input.durationSec}`,
      motion_strength: input.motionStrength,
    };
    const submission = await submit(input.model, body, keys);
    const result = await poll<FalVideoResult>(submission.status_url, submission.response_url, keys);
    const videoUrl = result.video?.url;
    if (!videoUrl) throw new ProviderError('FAL returned no video URL', 'fal');
    const objectUrl = await fetchAsObjectUrl(videoUrl);
    return { videoUrl: objectUrl, durationSec: input.durationSec };
  },
};
