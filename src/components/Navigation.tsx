import React from 'react';
import { LayoutDashboard, History, BarChart2, Settings, LucideIcon } from 'lucide-react';
import { TabName } from '../types';

interface NavigationProps {
  activeTab: TabName;
  onChange: (tab: TabName) => void;
}

const tabs: { id: TabName; label: string; Icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Home', Icon: LayoutDashboard },
  { id: 'history', label: 'History', Icon: History },
  { id: 'charts', label: 'Charts', Icon: BarChart2 },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

export default function Navigation({ activeTab, onChange }: NavigationProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-gray-100 safe-bottom">
      <div className="flex items-stretch max-w-lg mx-auto px-2 py-1">
        {tabs.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'text-primary-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              aria-label={label}
            >
              <div
                className={`p-1.5 rounded-xl transition-all duration-200 ${
                  isActive ? 'bg-primary-50' : ''
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.75} />
              </div>
              <span className={`text-[10px] font-medium ${isActive ? 'text-primary-600' : 'text-gray-400'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
