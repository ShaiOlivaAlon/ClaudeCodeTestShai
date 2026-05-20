import type { ApiKeys, AspectRatio, Provider, Role, RoleKey, Suggestion } from '../types';
import { buildAnimatePromptHint, buildImagePromptEnhancer, buildSuggestionSystemPrompt, buildSuggestionUserPrompt, type BriefForLLM } from './prompts';
import { dataUrlToBlob, falImageSize, klingAspect } from './utils';
import { findModel, IMAGE_MODELS, TEXT_MODELS, VIDEO_MODELS } from './models';

// ----- helpers --------------------------------------------------------------

function getRole(keys: ApiKeys, role: Role): RoleKey {
  const r = keys[role];
  if (!r || !r.key) throw new Error(`No API key configured for ${role}. Open Settings to add one.`);
  return r;
}

function providerOfModel(list: typeof TEXT_MODELS, modelId: string): Provider | null {
  return findModel(list, modelId)?.provider ?? null;
}

/** Closest aspect ratio Imagen accepts. */
function googleImageAspect(r: AspectRatio): '1:1' | '3:4' | '4:3' | '9:16' | '16:9' {
  switch (r) {
    case '1:1': return '1:1';
    case '9:16': case '2:3': case '4:5': return '9:16';
    case '16:9': case '3:2': case '5:4': return '16:9';
    case '3:4': return '3:4';
    case '4:3': return '4:3';
    default: return '1:1';
  }
}

/** Closest aspect ratio Veo accepts. */
function googleVideoAspect(r: AspectRatio): '16:9' | '9:16' {
  if (r === '9:16' || r === '3:4' || r === '4:5' || r === '2:3') return '9:16';
  return '16:9';
}

async function urlToBase64(url: string): Promise<{ b64: string; mime: string }> {
  if (url.startsWith('data:')) {
    const [meta, b64] = url.split(',');
    const mime = /data:([^;]+)/.exec(meta)?.[1] ?? 'image/png';
    return { b64, mime };
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch reference image (${res.status})`);
  const blob = await res.blob();
  const mime = blob.type || 'image/png';
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return { b64: btoa(bin), mime };
}

/** Strip ```json fences if a model wraps output. */
function extractJson(text: string): any {
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const body = fence ? fence[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  const slice = start >= 0 && end > start ? body.slice(start, end + 1) : body;
  return JSON.parse(slice);
}

/** Closest size OpenAI image models accept. */
function openaiImageSize(r: AspectRatio, model: string): string {
  const portrait  = r === '9:16' || r === '4:5' || r === '3:4' || r === '2:3';
  const landscape = r === '16:9' || r === '5:4' || r === '4:3' || r === '3:2';
  if (model.startsWith('gpt-image')) {
    if (portrait)  return '1024x1536';
    if (landscape) return '1536x1024';
    return '1024x1024';
  }
  // dall-e-3
  if (portrait)  return '1024x1792';
  if (landscape) return '1792x1024';
  return '1024x1024';
}

function requireAzureFields(r: RoleKey): { endpoint: string; deployment: string; apiVersion: string } {
  const endpoint = r.endpoint?.trim().replace(/\/$/, '');
  const deployment = r.deployment?.trim();
  const apiVersion = r.apiVersion?.trim() || '2024-10-21';
  if (!endpoint) throw new Error('Azure OpenAI: endpoint URL missing. Open Settings to set it.');
  if (!deployment) throw new Error('Azure OpenAI: deployment name missing. Open Settings to set it.');
  return { endpoint, deployment, apiVersion };
}

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

// ----- OpenAI --------------------------------------------------------------

async function openaiMessage(opts: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const isReasoning = /^o\d/.test(opts.model);
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: [
      // o1/o3 ignore system role but accept it without erroring.
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ],
  };
  // Reasoning models use max_completion_tokens; chat models accept either.
  body[isReasoning ? 'max_completion_tokens' : 'max_tokens'] = opts.maxTokens ?? 4096;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? '').trim();
}

async function openaiImageGenerate(opts: {
  apiKey: string;
  model: string;
  prompt: string;
  aspectRatio: AspectRatio;
}): Promise<{ url: string }> {
  const size = openaiImageSize(opts.aspectRatio, opts.model);
  const body: Record<string, unknown> = {
    model: opts.model,
    prompt: opts.prompt,
    size,
    n: 1,
  };
  // dall-e-3 supports response_format; gpt-image-1 always returns b64.
  if (opts.model === 'dall-e-3') body.response_format = 'b64_json';

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI Images error ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = await res.json();
  const item = data.data?.[0] ?? {};
  if (item.b64_json) return { url: `data:image/png;base64,${item.b64_json}` };
  if (item.url) return { url: item.url };
  throw new Error('OpenAI Images returned no result.');
}

// ----- Azure OpenAI --------------------------------------------------------

async function azureOpenAIMessage(opts: {
  apiKey: string;
  endpoint: string;
  deployment: string;
  apiVersion: string;
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const url = `${opts.endpoint}/openai/deployments/${encodeURIComponent(opts.deployment)}/chat/completions?api-version=${encodeURIComponent(opts.apiVersion)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'api-key': opts.apiKey },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
      max_tokens: opts.maxTokens ?? 4096,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Azure OpenAI error ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? '').trim();
}

async function azureOpenAIImageGenerate(opts: {
  apiKey: string;
  endpoint: string;
  deployment: string;
  apiVersion: string;
  prompt: string;
  aspectRatio: AspectRatio;
}): Promise<{ url: string }> {
  // Assume the user's Azure deployment is DALL·E 3 style (Azure's most common image deployment).
  const size = openaiImageSize(opts.aspectRatio, 'dall-e-3');
  const url = `${opts.endpoint}/openai/deployments/${encodeURIComponent(opts.deployment)}/images/generations?api-version=${encodeURIComponent(opts.apiVersion)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'api-key': opts.apiKey },
    body: JSON.stringify({ prompt: opts.prompt, size, n: 1 }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Azure OpenAI Images error ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = await res.json();
  const item = data.data?.[0] ?? {};
  if (item.b64_json) return { url: `data:image/png;base64,${item.b64_json}` };
  if (item.url) return { url: item.url };
  throw new Error('Azure OpenAI Images returned no result.');
}

// ----- Google (Gemini / Imagen / Veo) --------------------------------------

const GOOGLE_BASE = 'https://generativelanguage.googleapis.com/v1beta';

async function geminiMessage(opts: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const url = `${GOOGLE_BASE}/models/${opts.model}:generateContent?key=${encodeURIComponent(opts.apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: [{ role: 'user', parts: [{ text: opts.user }] }],
      generationConfig: { maxOutputTokens: opts.maxTokens ?? 4096, temperature: 0.9 },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p: any) => p?.text ?? '').join('\n').trim();
}

async function imagenGenerate(opts: {
  apiKey: string;
  model: string;
  prompt: string;
  aspectRatio: AspectRatio;
}): Promise<{ url: string }> {
  const url = `${GOOGLE_BASE}/models/${opts.model}:predict?key=${encodeURIComponent(opts.apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt: opts.prompt }],
      parameters: {
        aspectRatio: googleImageAspect(opts.aspectRatio),
        sampleCount: 1,
        personGeneration: 'allow_adult',
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Imagen API error ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = await res.json();
  const pred = data?.predictions?.[0];
  const b64 = pred?.bytesBase64Encoded ?? pred?.image?.bytesBase64Encoded;
  if (!b64) throw new Error('Imagen returned no image bytes.');
  const mime = pred?.mimeType ?? 'image/png';
  return { url: `data:${mime};base64,${b64}` };
}

/** "Nano Banana" family — Gemini multimodal models that emit images via the
 *  generateContent endpoint. Supports reference images as inline input. */
async function geminiImageGenerate(opts: {
  apiKey: string;
  model: string;
  prompt: string;
  aspectRatio: AspectRatio;
  referenceDataUrls?: string[];
}): Promise<{ url: string }> {
  const url = `${GOOGLE_BASE}/models/${opts.model}:generateContent?key=${encodeURIComponent(opts.apiKey)}`;
  const parts: any[] = [];
  if (opts.referenceDataUrls?.length) {
    for (const dataUrl of opts.referenceDataUrls.slice(0, 3)) {
      const { b64, mime } = await urlToBase64(dataUrl);
      parts.push({ inlineData: { data: b64, mimeType: mime } });
    }
  }
  const aspectHint = `\n\nRender the image in a ${opts.aspectRatio} aspect ratio.`;
  parts.push({ text: opts.prompt + aspectHint });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio: googleImageAspect(opts.aspectRatio) },
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini Image API error ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = await res.json();
  const candParts = data?.candidates?.[0]?.content?.parts ?? [];
  for (const p of candParts) {
    const inline = p?.inlineData ?? p?.inline_data;
    if (inline?.data) {
      const mime = inline.mimeType ?? inline.mime_type ?? 'image/png';
      return { url: `data:${mime};base64,${inline.data}` };
    }
  }
  throw new Error('Gemini Image returned no image bytes.');
}

async function veoGenerate(opts: {
  apiKey: string;
  model: string;
  prompt: string;
  imageUrl: string;
  aspectRatio: AspectRatio;
  onProgress?: (status: string) => void;
}): Promise<{ url: string }> {
  const submitUrl = `${GOOGLE_BASE}/models/${opts.model}:predictLongRunning?key=${encodeURIComponent(opts.apiKey)}`;
  const { b64, mime } = await urlToBase64(opts.imageUrl);
  const submit = await fetch(submitUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt: opts.prompt, image: { bytesBase64Encoded: b64, mimeType: mime } }],
      parameters: {
        aspectRatio: googleVideoAspect(opts.aspectRatio),
        durationSeconds: 8,
        personGeneration: 'allow_adult',
        numberOfVideos: 1,
      },
    }),
  });
  if (!submit.ok) {
    const text = await submit.text();
    throw new Error(`Veo submit error ${submit.status}: ${text.slice(0, 400)}`);
  }
  const op = await submit.json();
  const opName = op?.name;
  if (!opName) throw new Error('Veo did not return an operation name.');

  const start = Date.now();
  while (Date.now() - start < 10 * 60 * 1000) {
    const poll = await fetch(`${GOOGLE_BASE}/${opName}?key=${encodeURIComponent(opts.apiKey)}`);
    if (!poll.ok) throw new Error(`Veo poll error ${poll.status}`);
    const pd = await poll.json();
    opts.onProgress?.(pd?.metadata?.state ?? 'RUNNING');
    if (pd?.done) {
      if (pd?.error) throw new Error(`Veo error: ${pd.error?.message ?? JSON.stringify(pd.error)}`);
      const resp = pd?.response ?? {};
      const sample =
        resp?.generatedVideos?.[0] ??
        resp?.generateVideoResponse?.generatedSamples?.[0] ??
        resp?.videos?.[0];
      const videoB64 = sample?.video?.bytesBase64Encoded ?? sample?.bytesBase64Encoded;
      const uri = sample?.video?.uri ?? sample?.uri;
      if (videoB64) {
        return { url: `data:video/mp4;base64,${videoB64}` };
      }
      if (uri) {
        // Google video URIs require the API key appended to download from the browser.
        const sep = uri.includes('?') ? '&' : '?';
        return { url: `${uri}${sep}key=${encodeURIComponent(opts.apiKey)}` };
      }
      throw new Error('Veo job completed but no video was returned.');
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error('Veo job timed out.');
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

async function falGenerateImage(opts: {
  apiKey: string;
  model: string;
  prompt: string;
  aspectRatio: AspectRatio;
  referenceUrls?: string[];
  onProgress?: (status: string) => void;
}): Promise<{ url: string }> {
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
    input.image_size = imgSize;
    input.num_images = 1;
    input.enable_safety_checker = true;
  }

  const submit = await falSubmit(model, input, apiKey);
  await falPoll(submit.status_url, apiKey, onProgress);
  const out = await falResult<any>(submit.response_url, apiKey);

  const url: string | undefined = out?.images?.[0]?.url ?? out?.image?.url ?? out?.url;
  if (!url) throw new Error('Image URL not found in fal response');
  return { url };
}

async function falGenerateVideo(opts: {
  apiKey: string;
  model: string;
  prompt: string;
  imageUrl: string;
  aspectRatio: AspectRatio;
  onProgress?: (status: string) => void;
}): Promise<{ url: string }> {
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

// ----- Provider-dispatched public API --------------------------------------

async function dispatchText(role: RoleKey, model: string, system: string, user: string, maxTokens: number): Promise<string> {
  switch (role.provider) {
    case 'google':
      return geminiMessage({ apiKey: role.key, model, system, user, maxTokens });
    case 'anthropic':
      return anthropicMessage({ apiKey: role.key, model, system, user, maxTokens });
    case 'openai':
      return openaiMessage({ apiKey: role.key, model, system, user, maxTokens });
    case 'azure-openai': {
      const az = requireAzureFields(role);
      return azureOpenAIMessage({ apiKey: role.key, ...az, system, user, maxTokens });
    }
    default:
      throw new Error(`Provider ${role.provider} cannot generate text.`);
  }
}

export async function generateSuggestions(opts: {
  apiKeys: ApiKeys;
  textModel: string;
  brief: BriefForLLM;
}): Promise<Suggestion[]> {
  const role = getRole(opts.apiKeys, 'text');
  const modelProvider = providerOfModel(TEXT_MODELS, opts.textModel) ?? role.provider;
  if (modelProvider !== role.provider) {
    throw new Error(`Text model "${opts.textModel}" requires the ${modelProvider} provider, but your Text key is set to ${role.provider}.`);
  }

  const system = buildSuggestionSystemPrompt();
  const user = buildSuggestionUserPrompt(opts.brief);
  const raw = await dispatchText(role, opts.textModel, system, user, 6000);

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
  apiKeys: ApiKeys;
  textModel: string;
  prompt: string;
}): Promise<string> {
  const role = getRole(opts.apiKeys, 'text');
  const system = buildImagePromptEnhancer();
  const out = await dispatchText(role, opts.textModel, system, opts.prompt, 1500);
  return out.trim();
}

export interface ImageGenInput {
  apiKeys: ApiKeys;
  model: string;
  prompt: string;
  aspectRatio: AspectRatio;
  /** Asset data URLs to use as references (will be uploaded to fal if needed). */
  referenceDataUrls?: string[];
  onProgress?: (status: string) => void;
}

export async function generateImage(opts: ImageGenInput): Promise<{ url: string }> {
  const role = getRole(opts.apiKeys, 'image');
  const modelProvider = providerOfModel(IMAGE_MODELS, opts.model) ?? role.provider;
  if (modelProvider !== role.provider) {
    throw new Error(`Image model "${opts.model}" requires the ${modelProvider} provider, but your Image key is set to ${role.provider}.`);
  }

  if (role.provider === 'google') {
    // gemini-*-image models use generateContent with image output (Nano Banana family);
    // imagen-* models use the legacy :predict endpoint.
    if (opts.model.startsWith('imagen-')) {
      return imagenGenerate({ apiKey: role.key, model: opts.model, prompt: opts.prompt, aspectRatio: opts.aspectRatio });
    }
    return geminiImageGenerate({
      apiKey: role.key,
      model: opts.model,
      prompt: opts.prompt,
      aspectRatio: opts.aspectRatio,
      referenceDataUrls: opts.referenceDataUrls,
    });
  }

  if (role.provider === 'openai') {
    return openaiImageGenerate({ apiKey: role.key, model: opts.model, prompt: opts.prompt, aspectRatio: opts.aspectRatio });
  }

  if (role.provider === 'azure-openai') {
    const az = requireAzureFields(role);
    return azureOpenAIImageGenerate({ apiKey: role.key, ...az, prompt: opts.prompt, aspectRatio: opts.aspectRatio });
  }

  let referenceUrls: string[] = [];
  if (opts.referenceDataUrls?.length) {
    referenceUrls = await Promise.all(
      opts.referenceDataUrls.slice(0, 3).map((d, i) => falUpload(d, role.key, `ref-${i}.png`)),
    );
  }
  return falGenerateImage({
    apiKey: role.key,
    model: opts.model,
    prompt: opts.prompt,
    aspectRatio: opts.aspectRatio,
    referenceUrls,
    onProgress: opts.onProgress,
  });
}

export interface VideoGenInput {
  apiKeys: ApiKeys;
  model: string;
  prompt: string;
  imageUrl: string;
  aspectRatio: AspectRatio;
  onProgress?: (status: string) => void;
}

export async function generateVideo(opts: VideoGenInput): Promise<{ url: string }> {
  const role = getRole(opts.apiKeys, 'video');
  const modelProvider = providerOfModel(VIDEO_MODELS, opts.model) ?? role.provider;
  if (modelProvider !== role.provider) {
    throw new Error(`Video model "${opts.model}" requires the ${modelProvider} provider, but your Video key is set to ${role.provider}.`);
  }

  if (role.provider === 'google') {
    return veoGenerate({
      apiKey: role.key,
      model: opts.model,
      prompt: opts.prompt,
      imageUrl: opts.imageUrl,
      aspectRatio: opts.aspectRatio,
      onProgress: opts.onProgress,
    });
  }

  // fal video needs a public URL — if the image is a data URL, upload it first.
  let publicImageUrl = opts.imageUrl;
  if (publicImageUrl.startsWith('data:')) {
    publicImageUrl = await falUpload(publicImageUrl, role.key, 'frame.png');
  }
  return falGenerateVideo({
    apiKey: role.key,
    model: opts.model,
    prompt: opts.prompt,
    imageUrl: publicImageUrl,
    aspectRatio: opts.aspectRatio,
    onProgress: opts.onProgress,
  });
}

export function makeAnimatePrompt(suggestion: { title: string; description: string; prompt: string }): string {
  return buildAnimatePromptHint(suggestion);
}

// ----- API key validators -------------------------------------------------

export async function pingProvider(provider: Provider, apiKey: string, extra?: { endpoint?: string; deployment?: string; apiVersion?: string }): Promise<boolean> {
  try {
    if (provider === 'google') {
      const res = await fetch(`${GOOGLE_BASE}/models?key=${encodeURIComponent(apiKey)}&pageSize=1`);
      return res.ok;
    }
    if (provider === 'anthropic') {
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
      return res.ok || res.status === 400;
    }
    if (provider === 'fal') {
      const res = await fetch(`${FAL_REST}/storage/upload/initiate`, {
        method: 'POST',
        headers: { Authorization: `Key ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ file_name: 'x.txt', content_type: 'text/plain' }),
      });
      return res.ok || res.status === 400;
    }
    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.ok;
    }
    if (provider === 'azure-openai') {
      const endpoint = extra?.endpoint?.trim().replace(/\/$/, '');
      const apiVersion = extra?.apiVersion?.trim() || '2024-10-21';
      if (!endpoint) return false;
      // List deployments — works with just the resource key, no deployment name needed.
      const res = await fetch(`${endpoint}/openai/deployments?api-version=${encodeURIComponent(apiVersion)}`, {
        headers: { 'api-key': apiKey },
      });
      return res.ok;
    }
    return false;
  } catch {
    return false;
  }
}
