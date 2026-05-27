import { useEffect, useReducer, useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, LayoutGrid, Wand2 } from 'lucide-react';
import { initialState, reducer, StoreContext } from './state/store';
import { listAssets, listBriefPresets, listGameProjects, listGenerations, listReskinProjects, loadSettings } from './lib/storage';
import { Header } from './components/Header';
import { AssetLibrary } from './components/AssetLibrary';
import { MainPanel } from './components/MainPanel';
import { Gallery } from './components/Gallery';
import { SetupWizard } from './components/SetupWizard';
import { SettingsModal } from './components/SettingsModal';
import { DetailModal } from './components/DetailModal';
import { EditMaskModal } from './components/EditMaskModal';
import { ToastStack } from './components/ui';
import { cls } from './lib/utils';

type MobileTab = 'library' | 'brief' | 'gallery';

const PANEL_VARIANTS = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

export function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [mobileTab, setMobileTab] = useState<MobileTab>('brief');

  // Initial load from storage.
  useEffect(() => {
    (async () => {
      const settings = loadSettings();
      dispatch({ type: 'settings/set', settings });
      const [assets, generations, presets, gameProjects, reskinProjects] = await Promise.all([
        listAssets(),
        listGenerations(),
        listBriefPresets(),
        listGameProjects(),
        listReskinProjects(),
      ]);
      dispatch({ type: 'assets/set', assets });
      dispatch({ type: 'generations/set', generations });
      dispatch({ type: 'briefPresets/set', presets });
      dispatch({ type: 'gameProjects/set', projects: gameProjects });
      dispatch({ type: 'reskinProjects/set', projects: reskinProjects });

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

  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      <div className="flex h-[100dvh] flex-col overflow-hidden">
        <Header />

        {/* Desktop: 3-column grid. Mobile: single panel switched by the bottom nav.
            grid-cols-1 (= minmax(0, 1fr)) is critical — without it, a grid item's default
            min-width: auto lets long content force the column wider than the viewport. */}
        <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_minmax(0,1.4fr)_minmax(0,1fr)]">
          <motion.div
            variants={PANEL_VARIANTS}
            initial="initial"
            animate="animate"
            transition={{ delay: 0.05, duration: 0.35, ease: 'easeOut' }}
            className={cls('h-full min-h-0 min-w-0 overflow-hidden', mobileTab === 'library' ? 'block' : 'hidden', 'lg:block')}
          >
            <AssetLibrary />
          </motion.div>
          <motion.div
            variants={PANEL_VARIANTS}
            initial="initial"
            animate="animate"
            transition={{ delay: 0.12, duration: 0.35, ease: 'easeOut' }}
            className={cls('h-full min-h-0 min-w-0 overflow-hidden', mobileTab === 'brief' ? 'block' : 'hidden', 'lg:block')}
          >
            <MainPanel />
          </motion.div>
          <motion.div
            variants={PANEL_VARIANTS}
            initial="initial"
            animate="animate"
            transition={{ delay: 0.2, duration: 0.35, ease: 'easeOut' }}
            className={cls('h-full min-h-0 min-w-0 overflow-hidden', mobileTab === 'gallery' ? 'block' : 'hidden', 'lg:block')}
          >
            <Gallery />
          </motion.div>
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
        <EditMaskModal />
        <ToastStack toasts={state.ui.toasts} onDismiss={(id) => dispatch({ type: 'ui/dismissToast', id })} />
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
    <motion.nav
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.3, type: 'spring', stiffness: 320, damping: 30 }}
      className="grid grid-cols-3 border-t border-ink-800 bg-ink-950 lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {tabs.map((t) => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={cls(
              'flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition active:scale-95',
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
    </motion.nav>
  );
}
