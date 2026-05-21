import { useEffect, useReducer, useState } from 'react';
import { Crown, LayoutGrid, Wand2 } from 'lucide-react';
import { initialState, reducer, StoreContext } from './state/store';
import { listAssets, listBriefPresets, listGenerations, loadSettings } from './lib/storage';
import { Header } from './components/Header';
import { AssetLibrary } from './components/AssetLibrary';
import { BriefBuilder } from './components/BriefBuilder';
import { Gallery } from './components/Gallery';
import { SetupWizard } from './components/SetupWizard';
import { SettingsModal } from './components/SettingsModal';
import { DetailModal } from './components/DetailModal';
import { Toast } from './components/ui';
import { cls } from './lib/utils';

type MobileTab = 'library' | 'brief' | 'gallery';

export function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [mobileTab, setMobileTab] = useState<MobileTab>('brief');

  // Initial load from storage.
  useEffect(() => {
    (async () => {
      const settings = loadSettings();
      dispatch({ type: 'settings/set', settings });
      const [assets, generations, presets] = await Promise.all([
        listAssets(),
        listGenerations(),
        listBriefPresets(),
      ]);
      dispatch({ type: 'assets/set', assets });
      dispatch({ type: 'generations/set', generations });
      dispatch({ type: 'briefPresets/set', presets });

      // Push defaults into the brief if the user has changed model defaults in settings.
      dispatch({
        type: 'brief/patch',
        patch: {
          textModel: settings.defaultTextModel,
          imageModel: settings.defaultImageModel,
          videoModel: settings.defaultVideoModel,
        },
      });

      if (!settings.setupComplete) {
        dispatch({ type: 'ui/openSetup', open: true });
      }
    })();
  }, []);

  // Auto-dismiss toast.
  useEffect(() => {
    if (!state.ui.toast) return;
    const t = setTimeout(() => dispatch({ type: 'ui/toast', toast: null }), 4500);
    return () => clearTimeout(t);
  }, [state.ui.toast]);

  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      <div className="flex h-[100dvh] flex-col overflow-hidden">
        <Header />

        {/* Desktop: 3-column grid. Mobile: single panel switched by the bottom nav.
            grid-cols-1 (= minmax(0, 1fr)) is critical — without it, a grid item's default
            min-width: auto lets long content force the column wider than the viewport. */}
        <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className={cls('h-full min-h-0 min-w-0 overflow-hidden', mobileTab === 'library' ? 'block' : 'hidden', 'lg:block')}>
            <AssetLibrary />
          </div>
          <div className={cls('h-full min-h-0 min-w-0 overflow-hidden', mobileTab === 'brief' ? 'block' : 'hidden', 'lg:block')}>
            <BriefBuilder />
          </div>
          <div className={cls('h-full min-h-0 min-w-0 overflow-hidden', mobileTab === 'gallery' ? 'block' : 'hidden', 'lg:block')}>
            <Gallery />
          </div>
        </main>

        <MobileTabBar
          tab={mobileTab}
          onChange={setMobileTab}
          assetCount={state.assets.length}
          renderCount={state.generations.length}
        />

        <SetupWizard />
        <SettingsModal />
        <DetailModal />
        <Toast toast={state.ui.toast} onClose={() => dispatch({ type: 'ui/toast', toast: null })} />
      </div>
    </StoreContext.Provider>
  );
}

function MobileTabBar({
  tab, onChange, assetCount, renderCount,
}: {
  tab: MobileTab;
  onChange: (t: MobileTab) => void;
  assetCount: number;
  renderCount: number;
}) {
  const tabs: { id: MobileTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'library', label: 'Library', icon: <Crown size={18} />, badge: assetCount },
    { id: 'brief',   label: 'Brief',   icon: <Wand2 size={18} /> },
    { id: 'gallery', label: 'Gallery', icon: <LayoutGrid size={18} />, badge: renderCount },
  ];
  return (
    <nav className="grid grid-cols-3 border-t border-ink-800 bg-ink-950 lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {tabs.map((t) => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={cls(
              'flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition',
              active ? 'text-white' : 'text-ink-400 hover:text-ink-100'
            )}
          >
            <div className="relative">
              {t.icon}
              {!!t.badge && t.badge > 0 && (
                <span className="absolute -right-2 -top-1 min-w-[16px] rounded-full bg-brand-500 px-1 text-center text-[9px] font-bold leading-4 text-white">
                  {t.badge > 99 ? '99+' : t.badge}
                </span>
              )}
            </div>
            <span>{t.label}</span>
            <span className={cls('mt-0.5 h-0.5 w-6 rounded-full transition', active ? 'bg-brand-400' : 'bg-transparent')} />
          </button>
        );
      })}
    </nav>
  );
}
