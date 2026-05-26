import { VideoProvider, VideoGenInput, VideoGenOutput, ProviderError } from './types';
import { ApiKeys } from '../types';

const BASE = 'https://api.dev.runwayml.com/v1';

interface RunwayTask {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'THROTTLED' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  failure?: string;
  failureCode?: string;
  output?: string[];
}

function authHeaders(keys: ApiKeys): Record<string, string> {
  if (!keys.runway) throw new ProviderError('Runway key missing', 'runway');
  return {
    Authorization: `Bearer ${keys.runway}`,
    'Content-Type': 'application/json',
    'X-Runway-Version': '2024-11-06',
  };
}

export const runwayVideo: VideoProvider = {
  async generate(input: VideoGenInput, keys: ApiKeys): Promise<VideoGenOutput> {
    const r = await fetch(`${BASE}/image_to_video`, {
      method: 'POST',
      headers: authHeaders(keys),
      body: JSON.stringify({
        promptImage: input.sourceDataUrl,
        promptText: input.prompt,
        model: input.model,
        duration: input.durationSec,
        ratio: '1280:720',
      }),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      throw new ProviderError(`Runway start failed (${r.status}): ${text}`, 'runway');
    }
    const created: { id: string } = await r.json();
    const start = Date.now();
    while (Date.now() - start < 1000 * 60 * 15) {
      await new Promise((res) => setTimeout(res, 4000));
      const sr = await fetch(`${BASE}/tasks/${created.id}`, {
        headers: { Authorization: `Bearer ${keys.runway}`, 'X-Runway-Version': '2024-11-06' },
      });
      if (!sr.ok) continue;
      const task: RunwayTask = await sr.json();
      if (task.status === 'SUCCEEDED') {
        const url = task.output?.[0];
        if (!url) throw new ProviderError('Runway returned no output URL', 'runway');
        const vr = await fetch(url);
        if (!vr.ok) throw new ProviderError('Runway download failed', 'runway');
        const blob = await vr.blob();
        return { videoUrl: URL.createObjectURL(blob), durationSec: input.durationSec };
      }
      if (task.status === 'FAILED' || task.status === 'CANCELLED') {
        throw new ProviderError(
          `Runway ${task.status}: ${task.failure ?? task.failureCode ?? 'unknown'}`,
          'runway'
        );
      }
    }
    throw new ProviderError('Runway task timed out', 'runway');
  },
};
