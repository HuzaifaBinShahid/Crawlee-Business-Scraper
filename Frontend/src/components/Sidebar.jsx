import React from 'react';
import { Play, Database, BarChart3 } from 'lucide-react';

const TABS = [
  { id: 'run', label: 'Collect Data', icon: Play },
  { id: 'data', label: 'Data', icon: Database },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
];

export function Sidebar({ activeTab, onTabChange }) {
  return (
    <nav className="w-56 flex-shrink-0 bg-slate-900 border-r border-slate-700 shadow-sidebar flex flex-col">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Business Scraper
        </h2>
      </div>
      <ul className="flex flex-col p-2 gap-0.5">
        {TABS.map((tab, i) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <li key={tab.id} className="animate-slide-in-left" style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'both' }}>
              <button
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium
                  transition-all duration-200 ease-out
                  ${isActive
                    ? 'bg-slate-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }
                `}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} strokeWidth={2} />
                <span>{tab.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
