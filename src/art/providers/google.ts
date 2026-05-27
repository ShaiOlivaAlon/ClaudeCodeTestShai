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

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

function requireKey(keys: ApiKeys): string {
  if (!keys.google) throw new ProviderError('Google AI Studio key missing', 'google');
  return keys.google;
}

function dataUrlToBase64(dataUrl: string): { mimeType: string; data: string } {
  const [meta, b64] = dataUrl.split(',');
  const mimeMatch = /data:([^;]+);base64/.exec(meta);
  return { mimeType: mimeMatch?.[1] ?? 'image/png', data: b64 };
}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  inline_data?: { mime_type: string; data: string };
}

interface GeminiResponse {
  candidates?: { content: { parts: GeminiPart[] } }[];
}

export const googleImage: ImageProvider = {
  async generate(input: ImageGenInput, keys: ApiKeys): Promise<ImageGenOutput> {
    const key = requireKey(keys);
    const parts: GeminiPart[] = [
      {
        text:
          `Reskin this game asset while keeping the exact composition, silhouette, ` +
          `pose, and aspect ratio. Apply the new theme:\n\n${input.prompt}` +
          (input.negativePrompt ? `\n\nAvoid: ${input.negativePrompt}` : '') +
          (input.styleRefs.length ? `\n\nMatch the art style of the provided reference images.` : ''),
      },
      { inlineData: dataUrlToBase64(input.sourceDataUrl) },
    ];
    for (const ref of input.styleRefs) {
      parts.push({ inlineData: dataUrlToBase64(ref.dataUrl) });
    }

    const url = `${BASE}/models/${input.model}:generateContent?key=${encodeURIComponent(key)}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      throw new ProviderError(`Gemini image failed (${r.status}): ${text}`, 'google');
    }
    const json: GeminiResponse = await r.json();
    const partsOut = json.candidates?.[0]?.content?.parts ?? [];
    const imagePart = partsOut.find((p) => p.inlineData || p.inline_data);
    const inline = imagePart?.inlineData ?? imagePart?.inline_data;
    if (!inline) {
      throw new ProviderError('Gemini returned no image part', 'google');
    }
    const mime = 'mimeType' in inline ? inline.mimeType : inline.mime_type;
    const dataUrl = `data:${mime};base64,${inline.data}`;
    const blob = await (await fetch(dataUrl)).blob();
    const objectUrl = URL.createObjectURL(blob);
    return { previewUrl: objectUrl, width: input.width, height: input.height };
  },
};

export const googleText2Image: TextToImageProvider = {
  async generate(input: TextToImageInput, keys: ApiKeys): Promise<ImageGenOutput> {
    const key = requireKey(keys);
    // Imagen REST: :predict; Gemini multimodal: :generateContent.
    if (input.model.startsWith('imagen-')) {
      const url = `${BASE}/models/${input.model}:predict?key=${encodeURIComponent(key)}`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt: input.prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: aspectRatioOf(input.width, input.height),
            negativePrompt: input.negativePrompt || undefined,
          },
        }),
      });
      if (!r.ok) {
        const text = await r.text().catch(() => '');
        throw new ProviderError(`Imagen failed (${r.status}): ${text}`, 'google');
      }
      const json: { predictions?: { bytesBase64Encoded?: string; mimeType?: string }[] } =
        await r.json();
      const pred = json.predictions?.[0];
      if (!pred?.bytesBase64Encoded) {
        throw new ProviderError('Imagen returned no image', 'google');
      }
      const dataUrl = `data:${pred.mimeType ?? 'image/png'};base64,${pred.bytesBase64Encoded}`;
      const blob = await (await fetch(dataUrl)).blob();
      return { previewUrl: URL.createObjectURL(blob), width: input.width, height: input.height };
    }

    // Gemini image preview
    const parts: GeminiPart[] = [
      {
        text:
          `Generate a new ${input.width}x${input.height} image: ${input.prompt}` +
          (input.negativePrompt ? `\n\nAvoid: ${input.negativePrompt}` : '') +
          (input.styleRefs.length ? `\n\nMatch the art style of the provided reference images.` : ''),
      },
    ];
    for (const ref of input.styleRefs) {
      parts.push({ inlineData: dataUrlToBase64(ref.dataUrl) });
    }
    const url = `${BASE}/models/${input.model}:generateContent?key=${encodeURIComponent(key)}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      throw new ProviderError(`Gemini image failed (${r.status}): ${text}`, 'google');
    }
    const json: GeminiResponse = await r.json();
    const partsOut = json.candidates?.[0]?.content?.parts ?? [];
    const imagePart = partsOut.find((p) => p.inlineData || p.inline_data);
    const inline = imagePart?.inlineData ?? imagePart?.inline_data;
    if (!inline) throw new ProviderError('Gemini returned no image part', 'google');
    const mime = 'mimeType' in inline ? inline.mimeType : inline.mime_type;
    const dataUrl = `data:${mime};base64,${inline.data}`;
    const blob = await (await fetch(dataUrl)).blob();
    return { previewUrl: URL.createObjectURL(blob), width: input.width, height: input.height };
  },
};

function aspectRatioOf(w: number, h: number): string {
  const ratio = w / h;
  // Imagen accepts a fixed list; pick the closest match.
  const options: [string, number][] = [
    ['1:1', 1],
    ['16:9', 16 / 9],
    ['9:16', 9 / 16],
    ['4:3', 4 / 3],
    ['3:4', 3 / 4],
  ];
  let best = options[0];
  let bestDelta = Math.abs(ratio - best[1]);
  for (const opt of options.slice(1)) {
    const delta = Math.abs(ratio - opt[1]);
    if (delta < bestDelta) {
      best = opt;
      bestDelta = delta;
    }
  }
  return best[0];
}

interface VeoOperation {
  name: string;
  done?: boolean;
  response?: {
    generatedVideos?: { video?: { uri?: string } }[];
    generateVideoResponse?: { generatedSamples?: { video?: { uri?: string } }[] };
  };
  error?: { message?: string };
}

export const googleVideo: VideoProvider = {
  async generate(input: VideoGenInput, keys: ApiKeys): Promise<VideoGenOutput> {
    const key = requireKey(keys);
    const imagePart = dataUrlToBase64(input.sourceDataUrl);
    const startUrl = `${BASE}/models/${input.model}:predictLongRunning?key=${encodeURIComponent(key)}`;
    const r = await fetch(startUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [
          {
            prompt: input.prompt,
            image: { bytesBase64Encoded: imagePart.data, mimeType: imagePart.mimeType },
          },
        ],
        parameters: { durationSeconds: input.durationSec, aspectRatio: '16:9' },
      }),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      throw new ProviderError(`Veo start failed (${r.status}): ${text}`, 'google');
    }
    const op: VeoOperation = await r.json();
    const opName = op.name;
    const start = Date.now();
    while (Date.now() - start < 1000 * 60 * 15) {
      await new Promise((res) => setTimeout(res, 4000));
      const statusUrl = `${BASE}/${opName}?key=${encodeURIComponent(key)}`;
      const sr = await fetch(statusUrl);
      if (!sr.ok) continue;
      const sj: VeoOperation = await sr.json();
      if (sj.error) throw new ProviderError(`Veo failed: ${sj.error.message}`, 'google');
      if (sj.done) {
        const uri =
          sj.response?.generatedVideos?.[0]?.video?.uri ??
          sj.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
        if (!uri) throw new ProviderError('Veo returned no video URI', 'google');
        const vr = await fetch(`${uri}&key=${encodeURIComponent(key)}`);
        if (!vr.ok) throw new ProviderError('Veo download failed', 'google');
        const blob = await vr.blob();
        return { videoUrl: URL.createObjectURL(blob), durationSec: input.durationSec };
      }
    }
    throw new ProviderError('Veo timed out', 'google');
  },
};
