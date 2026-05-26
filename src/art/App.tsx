import { NavLink, Route, Routes, Navigate, Link } from 'react-router-dom';
import { Palette, Film, Settings as SettingsIcon, Home } from 'lucide-react';
import { ArtStoreProvider } from './store';
import ReskinTab from './tabs/ReskinTab';
import AnimateTab from './tabs/AnimateTab';
import SettingsTab from './tabs/SettingsTab';

export default function ArtApp() {
  return (
    <ArtStoreProvider>
      <div className="min-h-dvh bg-app-bg flex flex-col">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto flex items-center gap-4 px-4 py-3">
            <Link to="/" className="text-gray-500 hover:text-primary-600" title="Home">
              <Home className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center text-white font-bold">
                A
              </div>
              <div>
                <h1 className="font-bold leading-tight">Art Pipeline</h1>
                <div className="text-[10px] text-gray-500 leading-tight">
                  Reskin · Animate
                </div>
              </div>
            </div>
            <nav className="ml-auto flex items-center gap-1">
              <Tab to="reskin" icon={<Palette className="w-4 h-4" />} label="Reskin" />
              <Tab to="animate" icon={<Film className="w-4 h-4" />} label="Animate" />
              <Tab to="settings" icon={<SettingsIcon className="w-4 h-4" />} label="Settings" />
            </nav>
          </div>
        </header>
        <main className="flex-1">
          <Routes>
            <Route index element={<Navigate to="reskin" replace />} />
            <Route path="reskin" element={<ReskinTab />} />
            <Route path="animate" element={<AnimateTab />} />
            <Route path="settings" element={<SettingsTab />} />
          </Routes>
        </main>
      </div>
    </ArtStoreProvider>
  );
}

function Tab({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
          isActive
            ? 'bg-primary-500 text-white'
            : 'text-gray-700 hover:bg-primary-50'
        }`
      }
    >
      {icon} <span className="hidden sm:inline">{label}</span>
    </NavLink>
  );
}
