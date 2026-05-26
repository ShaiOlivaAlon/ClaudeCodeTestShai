import { ProviderId } from '../types';
import { ImageProvider, VideoProvider, RequiresProxyError } from './types';
import { falImage, falVideo } from './fal';
import { googleImage, googleVideo } from './google';
import { runwayVideo } from './runway';
import { litellmImage, litellmVideo } from './litellm';

function notImplemented(id: ProviderId): ImageProvider & VideoProvider {
  return {
    async generate(): Promise<never> {
      throw new RequiresProxyError(id);
    },
  };
}

export function getImageProvider(id: ProviderId): ImageProvider {
  switch (id) {
    case 'fal':
      return falImage;
    case 'google':
      return googleImage;
    case 'litellm':
      return litellmImage;
    default:
      return notImplemented(id);
  }
}

export function getVideoProvider(id: ProviderId): VideoProvider {
  switch (id) {
    case 'fal':
      return falVideo;
    case 'google':
      return googleVideo;
    case 'runway':
      return runwayVideo;
    case 'litellm':
      return litellmVideo;
    default:
      return notImplemented(id);
  }
}
