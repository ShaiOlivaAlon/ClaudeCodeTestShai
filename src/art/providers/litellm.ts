import {
  ImageProvider,
  TextToImageProvider,
  TextToImageInput,
  VideoProvider,
  ImageGenInput,
  ImageGenOutput,
  VideoGenInput,
  VideoGenOutput,
  ProviderError,
} from './types';
import { ApiKeys } from '../types';

/**
 * LiteLLM acts as a unified proxy. We hit the OpenAI-compatible image route by default;
 * users self-hosting can configure their base URL in Settings.
 */

function baseUrl(keys: ApiKeys): string {
  const url = keys.litellmBase?.replace(/\/+$/, '');
  if (!url) throw new ProviderError('LiteLLM base URL missing (Settings → LiteLLM)', 'litellm');
  return url;
}

function authHeaders(keys: ApiKeys): Record<string, string> {
  if (!keys.litellm) throw new ProviderError('LiteLLM key missing', 'litellm');
  return {
    Authorization: `Bearer ${keys.litellm}`,
    'Content-Type': 'application/json',
  };
}

export const litellmImage: ImageProvider = {
  async generate(input: ImageGenInput, keys: ApiKeys): Promise<ImageGenOutput> {
    const url = `${baseUrl(keys)}/v1/images/generations`;
    const r = await fetch(url, {
      method: 'POST',
      headers: authHeaders(keys),
      body: JSON.stringify({
        model: input.model,
        prompt: input.prompt,
        image: input.sourceDataUrl,
        size: `${input.width}x${input.height}`,
        n: 1,
      }),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      throw new ProviderError(`LiteLLM image failed (${r.status}): ${text}`, 'litellm');
    }
    const json: { data?: { url?: string; b64_json?: string }[] } = await r.json();
    const item = json.data?.[0];
    let blob: Blob;
    if (item?.b64_json) {
      blob = await (await fetch(`data:image/png;base64,${item.b64_json}`)).blob();
    } else if (item?.url) {
      const imgRes = await fetch(item.url);
      if (!imgRes.ok) throw new ProviderError('LiteLLM result download failed', 'litellm');
      blob = await imgRes.blob();
    } else {
      throw new ProviderError('LiteLLM returned no image', 'litellm');
    }
    return {
      previewUrl: URL.createObjectURL(blob),
      width: input.width,
      height: input.height,
    };
  },
};

export const litellmText2Image: TextToImageProvider = {
  async generate(input: TextToImageInput, keys: ApiKeys): Promise<ImageGenOutput> {
    const url = `${baseUrl(keys)}/v1/images/generations`;
    const r = await fetch(url, {
      method: 'POST',
      headers: authHeaders(keys),
      body: JSON.stringify({
        model: input.model,
        prompt: input.prompt,
        size: `${input.width}x${input.height}`,
        n: 1,
      }),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      throw new ProviderError(`LiteLLM text-to-image failed (${r.status}): ${text}`, 'litellm');
    }
    const json: { data?: { url?: string; b64_json?: string }[] } = await r.json();
    const item = json.data?.[0];
    let blob: Blob;
    if (item?.b64_json) {
      blob = await (await fetch(`data:image/png;base64,${item.b64_json}`)).blob();
    } else if (item?.url) {
      const imgRes = await fetch(item.url);
      if (!imgRes.ok) throw new ProviderError('LiteLLM result download failed', 'litellm');
      blob = await imgRes.blob();
    } else {
      throw new ProviderError('LiteLLM returned no image', 'litellm');
    }
    return { previewUrl: URL.createObjectURL(blob), width: input.width, height: input.height };
  },
};

export const litellmVideo: VideoProvider = {
  async generate(input: VideoGenInput, keys: ApiKeys): Promise<VideoGenOutput> {
    const url = `${baseUrl(keys)}/v1/videos/generations`;
    const r = await fetch(url, {
      method: 'POST',
      headers: authHeaders(keys),
      body: JSON.stringify({
        model: input.model,
        prompt: input.prompt,
        image: input.sourceDataUrl,
        duration: input.durationSec,
      }),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      throw new ProviderError(`LiteLLM video failed (${r.status}): ${text}`, 'litellm');
    }
    const json: { data?: { url?: string }[] } = await r.json();
    const videoUrl = json.data?.[0]?.url;
    if (!videoUrl) throw new ProviderError('LiteLLM returned no video', 'litellm');
    const vr = await fetch(videoUrl);
    if (!vr.ok) throw new ProviderError('LiteLLM video download failed', 'litellm');
    return {
      videoUrl: URL.createObjectURL(await vr.blob()),
      durationSec: input.durationSec,
    };
  },
};
