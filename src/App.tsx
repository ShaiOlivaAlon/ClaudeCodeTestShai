import { useEffect, useReducer } from 'react';
import { initialState, reducer, StoreContext } from './state/store';
import { listAssets, listGenerations, loadSettings } from './lib/storage';
import { Header } from './components/Header';
import { AssetLibrary } from './components/AssetLibrary';
import { BriefBuilder } from './components/BriefBuilder';
import { Gallery } from './components/Gallery';
import { SetupWizard } from './components/SetupWizard';
import { SettingsModal } from './components/SettingsModal';
import { DetailModal } from './components/DetailModal';
import { Toast } from './components/ui';

export function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Initial load from storage.
  useEffect(() => {
    (async () => {
      const settings = loadSettings();
      dispatch({ type: 'settings/set', settings });
      const [assets, generations] = await Promise.all([listAssets(), listGenerations()]);
      dispatch({ type: 'assets/set', assets });
      dispatch({ type: 'generations/set', generations });

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
      <div className="flex h-screen flex-col overflow-hidden">
        <Header />
        <main className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1.4fr)_minmax(0,1fr)]">
          <AssetLibrary />
          <BriefBuilder />
          <Gallery />
        </main>
        <SetupWizard />
        <SettingsModal />
        <DetailModal />
        <Toast toast={state.ui.toast} onClose={() => dispatch({ type: 'ui/toast', toast: null })} />
      </div>
    </StoreContext.Provider>
  );
}
