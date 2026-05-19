import React, { useReducer, useEffect, useRef, useCallback } from 'react';
import { TabName, AppAction, AppState, SleepEntry } from './types';
import { loadEntries, saveEntries, loadSettings, saveSettings, generateId } from './utils/storage';
import { classifySleepType, getActiveSleep } from './utils/sleepLogic';
import { rescheduleNotifications, clearAllNotifications } from './utils/notifications';
import Dashboard from './components/Dashboard';
import History from './components/History';
import Charts from './components/Charts';
import Settings from './components/Settings';
import Navigation from './components/Navigation';
import EditEntryModal from './components/EditEntryModal';

// ─── Reducer ────────────────────────────────────────────────────────────────

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'START_SLEEP': {
      // End any currently active sleep first
      const withEnded = state.entries.map((e) =>
        e.endTime === null
          ? { ...e, endTime: new Date().toISOString() }
          : e
      );
      const newEntry: SleepEntry = {
        id: generateId(),
        startTime: new Date().toISOString(),
        endTime: null,
        type: classifySleepType(new Date()),
      };
      const newEntries = [newEntry, ...withEnded];
      saveEntries(newEntries);
      return { ...state, entries: newEntries };
    }
    case 'STOP_SLEEP': {
      const newEntries = state.entries.map((e) =>
        e.endTime === null
          ? { ...e, endTime: new Date().toISOString() }
          : e
      );
      saveEntries(newEntries);
      return { ...state, entries: newEntries };
    }
    case 'ADD_ENTRY': {
      const newEntries = [action.entry, ...state.entries].sort(
        (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );
      saveEntries(newEntries);
      return { ...state, entries: newEntries };
    }
    case 'UPDATE_ENTRY': {
      const newEntries = state.entries.map((e) =>
        e.id === action.entry.id ? action.entry : e
      );
      saveEntries(newEntries);
      return { ...state, entries: newEntries };
    }
    case 'DELETE_ENTRY': {
      const newEntries = state.entries.filter((e) => e.id !== action.id);
      saveEntries(newEntries);
      return { ...state, entries: newEntries };
    }
    case 'SET_ENTRIES': {
      saveEntries(action.entries);
      return { ...state, entries: action.entries };
    }
    default:
      return state;
  }
}

// ─── App Component ───────────────────────────────────────────────────────────

export default function App() {
  const [activeTab, setActiveTab] = React.useState<TabName>('dashboard');
  const [editingEntry, setEditingEntry] = React.useState<SleepEntry | null>(null);
  const [isAddingEntry, setIsAddingEntry] = React.useState(false);
  const [tick, setTick] = React.useState(0); // Force re-render every 30s

  const initialState: AppState = {
    entries: loadEntries(),
    settings: loadSettings(),
  };

  const [state, dispatch] = useReducer(appReducer, initialState);

  // Keep settings in sync with localStorage and allow mutation
  const [settings, setSettings] = React.useState(initialState.settings);

  const handleSaveSettings = useCallback((newSettings: typeof settings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    rescheduleNotifications(state.entries, newSettings);
  }, [state.entries]);

  // Auto-refresh timer (every 30 seconds)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    tickRef.current = setInterval(() => setTick((t) => t + 1), 30000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  // Reschedule notifications whenever entries or settings change
  useEffect(() => {
    rescheduleNotifications(state.entries, settings);
    return () => clearAllNotifications();
  }, [state.entries, settings]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleStartSleep = useCallback(() => {
    dispatch({ type: 'START_SLEEP' });
  }, []);

  const handleStopSleep = useCallback(() => {
    dispatch({ type: 'STOP_SLEEP' });
  }, []);

  const handleEditEntry = useCallback((entry: SleepEntry) => {
    setEditingEntry(entry);
    setIsAddingEntry(false);
  }, []);

  const handleAddEntry = useCallback(() => {
    setIsAddingEntry(true);
    setEditingEntry(null);
  }, []);

  const handleSaveEntry = useCallback((entry: SleepEntry) => {
    if (isAddingEntry) {
      dispatch({ type: 'ADD_ENTRY', entry });
    } else {
      dispatch({ type: 'UPDATE_ENTRY', entry });
    }
    setEditingEntry(null);
    setIsAddingEntry(false);
  }, [isAddingEntry]);

  const handleDeleteEntry = useCallback((id: string) => {
    dispatch({ type: 'DELETE_ENTRY', id });
  }, []);

  const handleCloseModal = useCallback(() => {
    setEditingEntry(null);
    setIsAddingEntry(false);
  }, []);

  const activeSleep = getActiveSleep(state.entries);

  return (
    <div className="flex flex-col min-h-dvh bg-app-bg font-sans">
      {/* Main content area */}
      <main className="flex-1 overflow-y-auto pb-20" key={tick}>
        {activeTab === 'dashboard' && (
          <Dashboard
            entries={state.entries}
            settings={settings}
            activeSleep={activeSleep}
            onStartSleep={handleStartSleep}
            onStopSleep={handleStopSleep}
          />
        )}
        {activeTab === 'history' && (
          <History
            entries={state.entries}
            onEdit={handleEditEntry}
            onDelete={handleDeleteEntry}
            onAdd={handleAddEntry}
          />
        )}
        {activeTab === 'charts' && (
          <Charts entries={state.entries} />
        )}
        {activeTab === 'settings' && (
          <Settings
            settings={settings}
            onSave={handleSaveSettings}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <Navigation activeTab={activeTab} onChange={setActiveTab} />

      {/* Edit / Add Entry Modal */}
      {(editingEntry || isAddingEntry) && (
        <EditEntryModal
          entry={editingEntry}
          onSave={handleSaveEntry}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
