import { ProviderId, ProviderMeta } from '../types';

export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  fal: {
    id: 'fal',
    label: 'FAL.AI',
    capabilities: ['image', 'video', 'lora'],
    browserDirect: true,
    docsUrl: 'https://fal.ai/dashboard/keys',
  },
  google: {
    id: 'google',
    label: 'Google AI Studio',
    capabilities: ['image', 'video'],
    browserDirect: true,
    docsUrl: 'https://aistudio.google.com/app/apikey',
  },
  runway: {
    id: 'runway',
    label: 'Runway',
    capabilities: ['video'],
    browserDirect: true,
    docsUrl: 'https://dev.runwayml.com/',
  },
  litellm: {
    id: 'litellm',
    label: 'LiteLLM',
    capabilities: ['image', 'video'],
    browserDirect: true,
    docsUrl: 'https://docs.litellm.ai/',
    endpointHint: 'Self-hosted base URL, e.g. https://litellm.example.com',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    capabilities: ['image'],
    browserDirect: false,
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  azure: {
    id: 'azure',
    label: 'Azure OpenAI',
    capabilities: ['image'],
    browserDirect: false,
    docsUrl: 'https://learn.microsoft.com/azure/ai-services/openai/',
  },
  claude: {
    id: 'claude',
    label: 'Anthropic Claude',
    capabilities: ['image'],
    browserDirect: false,
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  aws: {
    id: 'aws',
    label: 'AWS Bedrock',
    capabilities: ['image', 'video'],
    browserDirect: false,
    docsUrl: 'https://aws.amazon.com/bedrock/',
  },
  gcp: {
    id: 'gcp',
    label: 'GCP Vertex AI',
    capabilities: ['image', 'video'],
    browserDirect: false,
    docsUrl: 'https://cloud.google.com/vertex-ai',
  },
};

export const PROVIDER_LIST: ProviderMeta[] = Object.values(PROVIDERS);

export function imageProviders(): ProviderMeta[] {
  return PROVIDER_LIST.filter((p) => p.capabilities.includes('image'));
}

export function videoProviders(): ProviderMeta[] {
  return PROVIDER_LIST.filter((p) => p.capabilities.includes('video'));
}

/** Suggested model lists per provider (curated, not exhaustive). */
export const IMAGE_MODELS: Record<ProviderId, string[]> = {
  fal: [
    'fal-ai/flux/dev/image-to-image',
    'fal-ai/flux-lora/image-to-image',
    'fal-ai/flux-pro/v1.1/redux',
    'fal-ai/stable-diffusion-v35-large/image-to-image',
    'fal-ai/recraft-v3/image-to-image',
    'fal-ai/ideogram/v2/edit',
  ],
  google: [
    'gemini-2.5-flash-image-preview',
    'imagen-3.0-generate-002',
  ],
  runway: [],
  litellm: [
    'fal-ai/flux/dev/image-to-image',
    'gemini-2.5-flash-image-preview',
    'dall-e-3',
  ],
  openai: ['gpt-image-1', 'dall-e-3'],
  azure: ['dall-e-3'],
  claude: ['claude-opus-4-7'],
  aws: ['amazon.titan-image-generator-v2', 'stability.stable-diffusion-xl-v1'],
  gcp: ['imagen-3.0-generate-001', 'imagen-3.0-fast-generate-001'],
};

export const VIDEO_MODELS: Record<ProviderId, string[]> = {
  fal: [
    'fal-ai/minimax/video-01/image-to-video',
    'fal-ai/kling-video/v1.6/standard/image-to-video',
    'fal-ai/luma-dream-machine/image-to-video',
    'fal-ai/runway-gen3/turbo/image-to-video',
    'fal-ai/veo3/image-to-video',
  ],
  google: ['veo-3.0-generate-001', 'veo-3.0-fast-generate-001'],
  runway: ['gen4_turbo', 'gen3a_turbo'],
  litellm: ['fal-ai/minimax/video-01/image-to-video', 'veo-3.0-generate-001'],
  openai: [],
  azure: [],
  claude: [],
  aws: ['amazon.nova-reel-v1:1'],
  gcp: ['veo-3.0-generate-001'],
};
