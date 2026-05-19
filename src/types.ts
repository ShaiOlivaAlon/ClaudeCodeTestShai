export type AssetKind = 'character' | 'item' | 'logo' | 'reference';

export interface Asset {
  id: string;
  kind: AssetKind;
  name: string;
  dataUrl: string;
  mimeType: string;
}

export interface Brief {
  theme: string;
  seasons: string[];
  styles: string[];
  features: string[];
  titles: string[];
  copyExamples: string;
  notes: string;
}

export interface OutputSpec {
  aspects: string[];
  count: number;
  imageModel: 'imagen-4' | 'imagen-3' | 'gemini-image';
  videoModel: 'veo-3' | 'veo-2';
}

export interface Suggestion {
  id: string;
  category: string;
  label: string;
}

export interface VideoSharePoint {
  webUrl: string;
  downloadUrl?: string;
  id?: string;
}

export interface VideoResult {
  url: string; // backend-served MP4 URL
  model: string;
  sharepoint?: VideoSharePoint | null;
}

export interface GeneratedImage {
  id: string;
  dataUrl: string;
  mimeType: string;
  model: string;
  aspect: string;
  prompt: string;
  createdAt: number;
  video?: VideoResult;
  videoJobId?: string;
  videoLoading?: boolean;
  videoError?: string;
}
