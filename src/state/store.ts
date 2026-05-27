import { createContext, useContext } from 'react';
import type { Asset, Brief, BriefPreset, GameProject, Generation, ReskinProject, Settings, Suggestion } from '../types';

export interface ToastItem {
  id: string;
  kind: 'info' | 'success' | 'error';
  message: string;
  createdAt: number;
}

export interface AppState {
  settings: Settings;
  assets: Asset[];
  brief: Brief;
  suggestions: Suggestion[];
  generations: Generation[];
  briefPresets: BriefPreset[];
  gameProjects: GameProject[];
  /** Id of the game project currently being edited; null when no project is open. */
  activeGameProjectId: string | null;
  reskinProjects: ReskinProject[];
  activeReskinProjectId: string | null;
  /** UI: which modals are open. */
  ui: {
    setupOpen: boolean;
    settingsOpen: boolean;
    /** Generation id whose details modal is open; null = closed. */
    detailGenerationId: string | null;
    /** Generation id whose mask-edit modal is open; null = closed. */
    editMaskGenerationId: string | null;
    /** Stack of active toast notifications. */
    toasts: ToastItem[];
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
  | { type: 'assets/patch'; id: string; patch: Partial<Pick<Asset, 'name' | 'description'>> }
  | { type: 'assets/remove'; id: string }
  | { type: 'briefPresets/set'; presets: BriefPreset[] }
  | { type: 'briefPresets/upsert'; preset: BriefPreset }
  | { type: 'briefPresets/remove'; id: string }
  | { type: 'gameProjects/set'; projects: GameProject[] }
  | { type: 'gameProjects/upsert'; project: GameProject }
  | { type: 'gameProjects/remove'; id: string }
  | { type: 'gameProjects/setActive'; id: string | null }
  | { type: 'reskinProjects/set'; projects: ReskinProject[] }
  | { type: 'reskinProjects/upsert'; project: ReskinProject }
  | { type: 'reskinProjects/remove'; id: string }
  | { type: 'reskinProjects/setActive'; id: string | null }
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
  | { type: 'ui/openEditMask'; id: string | null }
  | { type: 'ui/toast'; toast: { kind: ToastItem['kind']; message: string } | null }
  | { type: 'ui/dismissToast'; id: string }
  | { type: 'ui/suggesting'; value: boolean }
  | { type: 'ui/generating'; value: boolean };

export const defaultBrief: Brief = {
  selectedAssetIds: [],
  aspectRatios: ['1:1', '9:16', '16:9'],
  mainPrompt: '',
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
    case 'assets/patch':
      return {
        ...state,
        assets: state.assets.map((a) => (a.id === action.id ? { ...a, ...action.patch } : a)),
      };
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
    case 'briefPresets/set':
      return { ...state, briefPresets: action.presets };
    case 'briefPresets/upsert': {
      const idx = state.briefPresets.findIndex((p) => p.id === action.preset.id);
      const list = idx >= 0
        ? state.briefPresets.map((p) => (p.id === action.preset.id ? action.preset : p))
        : [action.preset, ...state.briefPresets];
      return { ...state, briefPresets: list };
    }
    case 'briefPresets/remove':
      return { ...state, briefPresets: state.briefPresets.filter((p) => p.id !== action.id) };
    case 'gameProjects/set':
      return { ...state, gameProjects: action.projects };
    case 'gameProjects/upsert': {
      const idx = state.gameProjects.findIndex((p) => p.id === action.project.id);
      const list = idx >= 0
        ? state.gameProjects.map((p) => (p.id === action.project.id ? action.project : p))
        : [action.project, ...state.gameProjects];
      return { ...state, gameProjects: list };
    }
    case 'gameProjects/remove':
      return {
        ...state,
        gameProjects: state.gameProjects.filter((p) => p.id !== action.id),
        activeGameProjectId: state.activeGameProjectId === action.id ? null : state.activeGameProjectId,
      };
    case 'gameProjects/setActive':
      return { ...state, activeGameProjectId: action.id };
    case 'reskinProjects/set':
      return { ...state, reskinProjects: action.projects };
    case 'reskinProjects/upsert': {
      const idx = state.reskinProjects.findIndex((p) => p.id === action.project.id);
      const list = idx >= 0
        ? state.reskinProjects.map((p) => (p.id === action.project.id ? action.project : p))
        : [action.project, ...state.reskinProjects];
      return { ...state, reskinProjects: list };
    }
    case 'reskinProjects/remove':
      return {
        ...state,
        reskinProjects: state.reskinProjects.filter((p) => p.id !== action.id),
        activeReskinProjectId: state.activeReskinProjectId === action.id ? null : state.activeReskinProjectId,
      };
    case 'reskinProjects/setActive':
      return { ...state, activeReskinProjectId: action.id };
    case 'ui/openSetup':
      return { ...state, ui: { ...state.ui, setupOpen: action.open } };
    case 'ui/openSettings':
      return { ...state, ui: { ...state.ui, settingsOpen: action.open } };
    case 'ui/openDetail':
      return { ...state, ui: { ...state.ui, detailGenerationId: action.id } };
    case 'ui/openEditMask':
      return { ...state, ui: { ...state.ui, editMaskGenerationId: action.id } };
    case 'ui/toast': {
      if (!action.toast) return { ...state, ui: { ...state.ui, toasts: [] } };
      const id = `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const next: ToastItem = { id, kind: action.toast.kind, message: action.toast.message, createdAt: Date.now() };
      // Cap at 5 visible toasts; drop the oldest.
      const stack = [...state.ui.toasts, next].slice(-5);
      return { ...state, ui: { ...state.ui, toasts: stack } };
    }
    case 'ui/dismissToast':
      return { ...state, ui: { ...state.ui, toasts: state.ui.toasts.filter((t) => t.id !== action.id) } };
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
  briefPresets: [],
  gameProjects: [],
  activeGameProjectId: null,
  reskinProjects: [],
  activeReskinProjectId: null,
  ui: {
    setupOpen: false,
    settingsOpen: false,
    detailGenerationId: null,
    editMaskGenerationId: null,
    toasts: [],
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
