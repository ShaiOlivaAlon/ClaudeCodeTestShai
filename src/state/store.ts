import { createContext, useContext } from 'react';
import type { Asset, Brief, Generation, Settings, Suggestion } from '../types';

export interface AppState {
  settings: Settings;
  assets: Asset[];
  brief: Brief;
  suggestions: Suggestion[];
  generations: Generation[];
  /** UI: which modals are open. */
  ui: {
    setupOpen: boolean;
    settingsOpen: boolean;
    /** Generation id whose details modal is open; null = closed. */
    detailGenerationId: string | null;
    /** Status banner for cross-cutting notifications. */
    toast: { kind: 'info' | 'success' | 'error'; message: string } | null;
    /** True while suggestions are loading. */
    suggesting: boolean;
    /** True while a batch generate-images run is in progress. */
    generating: boolean;
  };
}

export type AppAction =
  | { type: 'settings/set'; settings: Settings }
  | { type: 'settings/patch'; patch: Partial<Settings> }
  | { type: 'assets/set'; assets: Asset[] }
  | { type: 'assets/add'; asset: Asset }
  | { type: 'assets/remove'; id: string }
  | { type: 'brief/patch'; patch: Partial<Brief> }
  | { type: 'brief/toggleAsset'; assetId: string }
  | { type: 'brief/toggleAspect'; ratio: Brief['aspectRatios'][number] }
  | { type: 'brief/toggleTag'; field: 'seasons' | 'themes' | 'styles' | 'features'; value: string }
  | { type: 'brief/setList'; field: 'textExamples' | 'titles'; values: string[] }
  | { type: 'suggestions/set'; suggestions: Suggestion[] }
  | { type: 'suggestions/toggle'; id: string }
  | { type: 'suggestions/selectAll'; selected: boolean }
  | { type: 'suggestions/clear' }
  | { type: 'generations/set'; generations: Generation[] }
  | { type: 'generations/upsert'; generation: Generation }
  | { type: 'generations/remove'; id: string }
  | { type: 'generations/clear' }
  | { type: 'ui/openSetup'; open: boolean }
  | { type: 'ui/openSettings'; open: boolean }
  | { type: 'ui/openDetail'; id: string | null }
  | { type: 'ui/toast'; toast: AppState['ui']['toast'] }
  | { type: 'ui/suggesting'; value: boolean }
  | { type: 'ui/generating'; value: boolean };

export const defaultBrief: Brief = {
  selectedAssetIds: [],
  aspectRatios: ['1:1', '9:16', '16:9'],
  seasons: [],
  themes: [],
  styles: [],
  features: [],
  textExamples: [],
  titles: [],
  notes: '',
  variationCount: 8,
  textModel: 'gemini-2.5-flash',
  imageModel: 'gemini-3-pro-image-preview',
  videoModel: 'veo-3.1-generate-preview',
};

export function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'settings/set':
      return { ...state, settings: action.settings };
    case 'settings/patch':
      return { ...state, settings: { ...state.settings, ...action.patch, apiKeys: { ...state.settings.apiKeys, ...action.patch.apiKeys } } };
    case 'assets/set':
      return { ...state, assets: action.assets };
    case 'assets/add':
      return { ...state, assets: [action.asset, ...state.assets.filter((a) => a.id !== action.asset.id)] };
    case 'assets/remove':
      return {
        ...state,
        assets: state.assets.filter((a) => a.id !== action.id),
        brief: { ...state.brief, selectedAssetIds: state.brief.selectedAssetIds.filter((id) => id !== action.id) },
      };
    case 'brief/patch':
      return { ...state, brief: { ...state.brief, ...action.patch } };
    case 'brief/toggleAsset': {
      const has = state.brief.selectedAssetIds.includes(action.assetId);
      return {
        ...state,
        brief: {
          ...state.brief,
          selectedAssetIds: has
            ? state.brief.selectedAssetIds.filter((id) => id !== action.assetId)
            : [...state.brief.selectedAssetIds, action.assetId],
        },
      };
    }
    case 'brief/toggleAspect': {
      const has = state.brief.aspectRatios.includes(action.ratio);
      return {
        ...state,
        brief: {
          ...state.brief,
          aspectRatios: has ? state.brief.aspectRatios.filter((r) => r !== action.ratio) : [...state.brief.aspectRatios, action.ratio],
        },
      };
    }
    case 'brief/toggleTag': {
      const list = state.brief[action.field];
      const has = list.includes(action.value);
      return {
        ...state,
        brief: { ...state.brief, [action.field]: has ? list.filter((x) => x !== action.value) : [...list, action.value] },
      };
    }
    case 'brief/setList':
      return { ...state, brief: { ...state.brief, [action.field]: action.values } };
    case 'suggestions/set':
      return { ...state, suggestions: action.suggestions };
    case 'suggestions/toggle':
      return {
        ...state,
        suggestions: state.suggestions.map((s) => (s.id === action.id ? { ...s, selected: !s.selected } : s)),
      };
    case 'suggestions/selectAll':
      return { ...state, suggestions: state.suggestions.map((s) => ({ ...s, selected: action.selected })) };
    case 'suggestions/clear':
      return { ...state, suggestions: [] };
    case 'generations/set':
      return { ...state, generations: action.generations };
    case 'generations/upsert': {
      const idx = state.generations.findIndex((g) => g.id === action.generation.id);
      const list = idx >= 0
        ? state.generations.map((g) => (g.id === action.generation.id ? action.generation : g))
        : [action.generation, ...state.generations];
      return { ...state, generations: list };
    }
    case 'generations/remove':
      return { ...state, generations: state.generations.filter((g) => g.id !== action.id) };
    case 'generations/clear':
      return { ...state, generations: [] };
    case 'ui/openSetup':
      return { ...state, ui: { ...state.ui, setupOpen: action.open } };
    case 'ui/openSettings':
      return { ...state, ui: { ...state.ui, settingsOpen: action.open } };
    case 'ui/openDetail':
      return { ...state, ui: { ...state.ui, detailGenerationId: action.id } };
    case 'ui/toast':
      return { ...state, ui: { ...state.ui, toast: action.toast } };
    case 'ui/suggesting':
      return { ...state, ui: { ...state.ui, suggesting: action.value } };
    case 'ui/generating':
      return { ...state, ui: { ...state.ui, generating: action.value } };
    default:
      return state;
  }
}

export const initialState: AppState = {
  settings: {
    apiKeys: {},
    defaultTextModel: 'gemini-2.5-flash',
    defaultImageModel: 'gemini-3-pro-image-preview',
    defaultVideoModel: 'veo-3.1-generate-preview',
    setupComplete: false,
  },
  assets: [],
  brief: defaultBrief,
  suggestions: [],
  generations: [],
  ui: {
    setupOpen: false,
    settingsOpen: false,
    detailGenerationId: null,
    toast: null,
    suggesting: false,
    generating: false,
  },
};

export interface StoreContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

export const StoreContext = createContext<StoreContextValue | null>(null);

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreContext.Provider');
  return ctx;
}
