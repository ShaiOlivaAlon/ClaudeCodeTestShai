import { ProviderId } from '../types';
import {
  ImageProvider,
  TextToImageProvider,
  VideoProvider,
  RequiresProxyError,
} from './types';
import { falImage, falText2Image, falVideo } from './fal';
import { googleImage, googleText2Image, googleVideo } from './google';
import { runwayVideo } from './runway';
import { litellmImage, litellmText2Image, litellmVideo } from './litellm';

function notImplemented(id: ProviderId): ImageProvider & TextToImageProvider & VideoProvider {
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

export function getTextToImageProvider(id: ProviderId): TextToImageProvider {
  switch (id) {
    case 'fal':
      return falText2Image;
    case 'google':
      return googleText2Image;
    case 'litellm':
      return litellmText2Image;
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
