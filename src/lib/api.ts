import type { ApiKeys, AspectRatio, Suggestion } from '../types';
import { buildAnimatePromptHint, buildImagePromptEnhancer, buildSuggestionSystemPrompt, buildSuggestionUserPrompt, type BriefForLLM } from './prompts';
import { dataUrlToBlob, falImageSize, klingAspect } from './utils';

// ----- Anthropic -----------------------------------------------------------

const ANTHROPIC_MODEL_MAP: Record<string, string> = {
  'claude-opus-4-7': 'claude-opus-4-7',
  'claude-sonnet-4-6': 'claude-sonnet-4-6',
  'claude-haiku-4-5': 'claude-haiku-4-5-20251001',
};

async function anthropicMessage(opts: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const modelId = ANTHROPIC_MODEL_MAP[opts.model] ?? opts.model;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': opts.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: opts.maxTokens ?? 4096,
      system: opts.system,
      messages: [{ role: 'user', content: opts.user }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = await res.json();
  const blocks = (data.content ?? []) as { type: string; text?: string }[];
  return blocks.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n').trim();
}

/** Strip ```json fences if a model wraps output. */
function extractJson(text: string): any {
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const body = fence ? fence[1] : text;
  // Find first { and last }
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  const slice = start >= 0 && end > start ? body.slice(start, end + 1) : body;
  return JSON.parse(slice);
}

export async function generateSuggestions(opts: {
  apiKey: string;
  textModel: string;
  brief: BriefForLLM;
}): Promise<Suggestion[]> {
  const raw = await anthropicMessage({
    apiKey: opts.apiKey,
    model: opts.textModel,
    system: buildSuggestionSystemPrompt(),
    user: buildSuggestionUserPrompt(opts.brief),
    maxTokens: 6000,
  });
  const parsed = extractJson(raw) as { ideas: { title: string; description: string; prompt: string; tags?: string[] }[] };
  return parsed.ideas.map((i, idx) => ({
    id: `sug_${Date.now()}_${idx}`,
    title: i.title ?? `Idea ${idx + 1}`,
    description: i.description ?? '',
    prompt: i.prompt ?? '',
    tags: i.tags ?? [],
    selected: true,
  }));
}

export async function enhancePrompt(opts: {
  apiKey: string;
  textModel: string;
  prompt: string;
}): Promise<string> {
  const out = await anthropicMessage({
    apiKey: opts.apiKey,
    model: opts.textModel,
    system: buildImagePromptEnhancer(),
    user: opts.prompt,
    maxTokens: 1500,
  });
  return out.trim();
}

// ----- fal.ai --------------------------------------------------------------

const FAL_QUEUE = 'https://queue.fal.run';
const FAL_REST = 'https://rest.alpha.fal.ai';

async function falSubmit(model: string, input: unknown, apiKey: string): Promise<{ request_id: string; status_url: string; response_url: string }> {
  const res = await fetch(`${FAL_QUEUE}/${model}`, {
    method: 'POST',
    headers: { Authorization: `Key ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`fal submit error ${res.status}: ${text.slice(0, 400)}`);
  }
  return res.json();
}

async function falPoll(statusUrl: string, apiKey: string, onProgress?: (s: string) => void): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < 10 * 60 * 1000) {
    const res = await fetch(`${statusUrl}?logs=0`, { headers: { Authorization: `Key ${apiKey}` } });
    if (!res.ok) throw new Error(`fal status error ${res.status}`);
    const data = await res.json();
    onProgress?.(String(data.status ?? ''));
    if (data.status === 'COMPLETED') return;
    if (data.status === 'CANCELED' || data.status === 'ERROR' || data.status === 'FAILED') {
      throw new Error(`fal job ${data.status}`);
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  throw new Error('fal job timed out');
}

async function falResult<T>(responseUrl: string, apiKey: string): Promise<T> {
  const res = await fetch(responseUrl, { headers: { Authorization: `Key ${apiKey}` } });
  if (!res.ok) throw new Error(`fal result error ${res.status}`);
  return res.json();
}

/** Upload a data URL to fal storage; returns a public URL the inference API can read. */
export async function falUpload(dataUrl: string, apiKey: string, filename = 'upload.png'): Promise<string> {
  const blob = dataUrlToBlob(dataUrl);
  const initRes = await fetch(`${FAL_REST}/storage/upload/initiate`, {
    method: 'POST',
    headers: { Authorization: `Key ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ file_name: filename, content_type: blob.type }),
  });
  if (!initRes.ok) {
    const t = await initRes.text();
    throw new Error(`fal storage initiate ${initRes.status}: ${t.slice(0, 300)}`);
  }
  const { upload_url, file_url } = await initRes.json();
  const put = await fetch(upload_url, { method: 'PUT', body: blob, headers: { 'content-type': blob.type } });
  if (!put.ok) throw new Error(`fal storage PUT ${put.status}`);
  return file_url as string;
}

export interface ImageGenInput {
  apiKey: string;
  model: string;
  prompt: string;
  aspectRatio: AspectRatio;
  referenceUrls?: string[];
  onProgress?: (status: string) => void;
}

export async function generateImage(opts: ImageGenInput): Promise<{ url: string }> {
  const { model, apiKey, prompt, aspectRatio, referenceUrls = [], onProgress } = opts;
  const imgSize = falImageSize(aspectRatio);

  const input: Record<string, unknown> = { prompt };

  if (model.includes('flux-pulid') && referenceUrls[0]) {
    input.reference_image_url = referenceUrls[0];
    input.image_size = imgSize;
    input.num_inference_steps = 20;
    input.guidance_scale = 4;
  } else if (model.includes('flux/dev/image-to-image') && referenceUrls[0]) {
    input.image_url = referenceUrls[0];
    input.strength = 0.75;
    input.image_size = imgSize;
  } else if (model.includes('ideogram')) {
    input.aspect_ratio = aspectRatio.includes(':') ? aspectRatio.replace(':', '_') : '1_1';
    input.style = 'realistic';
  } else if (model.includes('recraft')) {
    input.image_size = imgSize;
    input.style = 'digital_illustration';
  } else {
    // flux-pro / flux-dev family
    input.image_size = imgSize;
    input.num_images = 1;
    input.enable_safety_checker = true;
  }

  const submit = await falSubmit(model, input, apiKey);
  await falPoll(submit.status_url, apiKey, onProgress);
  const out = await falResult<any>(submit.response_url, apiKey);

  // fal models return either {images: [{url}]} or {image: {url}}
  const url: string | undefined = out?.images?.[0]?.url ?? out?.image?.url ?? out?.url;
  if (!url) throw new Error('Image URL not found in fal response');
  return { url };
}

export interface VideoGenInput {
  apiKey: string;
  model: string;
  prompt: string;
  imageUrl: string;
  aspectRatio: AspectRatio;
  onProgress?: (status: string) => void;
}

export async function generateVideo(opts: VideoGenInput): Promise<{ url: string }> {
  const { apiKey, model, prompt, imageUrl, aspectRatio, onProgress } = opts;
  const input: Record<string, unknown> = { prompt, image_url: imageUrl };

  if (model.includes('kling-video')) {
    input.duration = '5';
    input.aspect_ratio = klingAspect(aspectRatio);
    input.cfg_scale = 0.5;
  } else if (model.includes('runway-gen3')) {
    input.duration = 5;
    input.ratio = klingAspect(aspectRatio) === '9:16' ? '768:1280' : klingAspect(aspectRatio) === '16:9' ? '1280:768' : '960:960';
  } else if (model.includes('luma')) {
    input.aspect_ratio = klingAspect(aspectRatio);
  } else if (model.includes('veo3')) {
    input.aspect_ratio = klingAspect(aspectRatio);
    input.duration = '8s';
  }

  const submit = await falSubmit(model, input, apiKey);
  await falPoll(submit.status_url, apiKey, onProgress);
  const out = await falResult<any>(submit.response_url, apiKey);
  const url: string | undefined = out?.video?.url ?? out?.videos?.[0]?.url ?? out?.url;
  if (!url) throw new Error('Video URL not found in fal response');
  return { url };
}

export function makeAnimatePrompt(suggestion: { title: string; description: string; prompt: string }): string {
  return buildAnimatePromptHint(suggestion);
}

// ----- API key validators -------------------------------------------------

export async function pingAnthropic(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL_MAP['claude-haiku-4-5'],
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });
    return res.ok || res.status === 400; // 400 still proves auth worked
  } catch {
    return false;
  }
}

export async function pingFal(apiKey: string): Promise<boolean> {
  try {
    // hit a known cheap endpoint just to verify auth header is accepted
    const res = await fetch(`${FAL_REST}/storage/upload/initiate`, {
      method: 'POST',
      headers: { Authorization: `Key ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ file_name: 'x.txt', content_type: 'text/plain' }),
    });
    return res.ok || res.status === 400;
  } catch {
    return false;
  }
}

export function hasKeys(keys: ApiKeys, providers: Array<keyof ApiKeys>): boolean {
  return providers.every((p) => Boolean(keys[p]?.trim()));
}
