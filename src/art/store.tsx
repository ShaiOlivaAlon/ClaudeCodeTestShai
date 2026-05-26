import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ApiKeys,
  Asset,
  AnimationResult,
  ReskinResult,
  ReskinSettings,
  AnimateSettings,
} from './types';
import { loadKeys, saveKeys } from './utils/keys';
import { deleteResult, deleteSource, deleteVideo } from './utils/storage';

interface ArtStore {
  keys: ApiKeys;
  setKeys: (k: ApiKeys) => void;

  assets: Asset[];
  addAssets: (a: Asset[]) => void;
  removeAsset: (id: string) => void;
  clearAssets: () => void;
  selectedAssetIds: Set<string>;
  toggleSelected: (id: string) => void;
  selectAll: () => void;
  selectNone: () => void;

  reskinResults: ReskinResult[];
  upsertReskin: (r: ReskinResult) => void;
  removeReskin: (id: string) => void;
  clearReskinResults: () => void;

  animations: AnimationResult[];
  upsertAnimation: (a: AnimationResult) => void;
  removeAnimation: (id: string) => void;

  reskinSettings: ReskinSettings;
  setReskinSettings: (s: ReskinSettings) => void;

  animateSettings: AnimateSettings;
  setAnimateSettings: (s: AnimateSettings) => void;
}

const ArtContext = createContext<ArtStore | null>(null);

const DEFAULT_RESKIN: ReskinSettings = {
  prompt: '',
  negativePrompt: '',
  strength: 0.75,
  guidance: 3.5,
  steps: 28,
  seed: null,
  providerId: 'fal',
  model: 'fal-ai/flux-lora/image-to-image',
  loras: [],
  styleRefs: [],
  preserveSize: true,
};

const DEFAULT_ANIMATE: AnimateSettings = {
  prompt: '',
  providerId: 'fal',
  model: 'fal-ai/minimax/video-01/image-to-video',
  durationSec: 5,
  motionStrength: 0.6,
};

export function ArtStoreProvider({ children }: { children: React.ReactNode }) {
  const [keys, setKeysState] = useState<ApiKeys>(() => loadKeys());
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [reskinResults, setReskinResults] = useState<ReskinResult[]>([]);
  const [animations, setAnimations] = useState<AnimationResult[]>([]);
  const [reskinSettings, setReskinSettings] = useState<ReskinSettings>(DEFAULT_RESKIN);
  const [animateSettings, setAnimateSettings] = useState<AnimateSettings>(DEFAULT_ANIMATE);

  const setKeys = useCallback((k: ApiKeys) => {
    setKeysState(k);
    saveKeys(k);
  }, []);

  const addAssets = useCallback((newOnes: Asset[]) => {
    setAssets((prev) => {
      const seen = new Set(prev.map((a) => a.path));
      const filtered = newOnes.filter((a) => !seen.has(a.path));
      return [...prev, ...filtered];
    });
  }, []);

  const removeAsset = useCallback((id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    void deleteSource(id);
  }, []);

  const clearAssets = useCallback(() => {
    setAssets((prev) => {
      prev.forEach((a) => void deleteSource(a.id));
      return [];
    });
    setSelectedAssetIds(new Set());
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedAssetIds(new Set(assets.map((a) => a.id)));
  }, [assets]);

  const selectNone = useCallback(() => setSelectedAssetIds(new Set()), []);

  const upsertReskin = useCallback((r: ReskinResult) => {
    setReskinResults((prev) => {
      const idx = prev.findIndex((x) => x.id === r.id);
      if (idx === -1) return [...prev, r];
      const next = [...prev];
      next[idx] = r;
      return next;
    });
  }, []);

  const removeReskin = useCallback((id: string) => {
    setReskinResults((prev) => prev.filter((r) => r.id !== id));
    void deleteResult(id);
  }, []);

  const clearReskinResults = useCallback(() => {
    setReskinResults((prev) => {
      prev.forEach((r) => void deleteResult(r.id));
      return [];
    });
  }, []);

  const upsertAnimation = useCallback((a: AnimationResult) => {
    setAnimations((prev) => {
      const idx = prev.findIndex((x) => x.id === a.id);
      if (idx === -1) return [...prev, a];
      const next = [...prev];
      next[idx] = a;
      return next;
    });
  }, []);

  const removeAnimation = useCallback((id: string) => {
    setAnimations((prev) => prev.filter((a) => a.id !== id));
    void deleteVideo(id);
  }, []);

  // Revoke object URLs on unmount to avoid blob leaks
  useEffect(() => {
    return () => {
      assets.forEach((a) => URL.revokeObjectURL(a.previewUrl));
      reskinResults.forEach((r) => URL.revokeObjectURL(r.previewUrl));
      animations.forEach((a) => URL.revokeObjectURL(a.videoUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<ArtStore>(
    () => ({
      keys,
      setKeys,
      assets,
      addAssets,
      removeAsset,
      clearAssets,
      selectedAssetIds,
      toggleSelected,
      selectAll,
      selectNone,
      reskinResults,
      upsertReskin,
      removeReskin,
      clearReskinResults,
      animations,
      upsertAnimation,
      removeAnimation,
      reskinSettings,
      setReskinSettings,
      animateSettings,
      setAnimateSettings,
    }),
    [
      keys,
      setKeys,
      assets,
      addAssets,
      removeAsset,
      clearAssets,
      selectedAssetIds,
      toggleSelected,
      selectAll,
      selectNone,
      reskinResults,
      upsertReskin,
      removeReskin,
      clearReskinResults,
      animations,
      upsertAnimation,
      removeAnimation,
      reskinSettings,
      animateSettings,
    ]
  );

  return <ArtContext.Provider value={value}>{children}</ArtContext.Provider>;
}

export function useArt(): ArtStore {
  const ctx = useContext(ArtContext);
  if (!ctx) throw new Error('useArt must be used within ArtStoreProvider');
  return ctx;
}
