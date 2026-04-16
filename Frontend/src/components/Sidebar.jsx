import React from 'react';
import { Play, Database, BarChart3, History, Settings, Sparkles } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

const SECTIONS = [
  {
    label: 'Workflow',
    tabs: [
      { id: 'run', label: 'Collect Data', icon: Play },
      { id: 'data', label: 'Data', icon: Database },
    ],
  },
  {
    label: 'Analytics',
    tabs: [
      { id: 'stats', label: 'Stats', icon: BarChart3 },
    ],
  },
  {
    label: 'System',
    tabs: [
      { id: 'history', label: 'History', icon: History },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

export function Sidebar({ activeTab, onTabChange }) {
  let animIdx = 0;
  return (
    <nav
      className="w-60 flex-shrink-0 flex flex-col"
      style={{
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-subtle)',
      }}
    >
      {/* Brand */}
      <div className="px-4 pt-5 pb-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-[8px] flex items-center justify-center shadow-sm"
            style={{ background: 'var(--accent)' }}
          >
            <Sparkles className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <div className="text-[14px] font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Atlas
            </div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Business Scraper
            </div>
          </div>
        </div>
      </div>

      {/* Nav sections */}
      <div className="flex-1 overflow-y-auto py-3 px-2">
        {SECTIONS.map((section) => (
          <div key={section.label} className="mb-4">
            <div
              className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: 'var(--text-muted)' }}
            >
              {section.label}
            </div>
            <ul className="mt-0.5">
              {section.tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const i = animIdx++;
                return (
                  <li
                    key={tab.id}
                    className="animate-slide-in-left"
                    style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'both' }}
                  >
                    <button
                      type="button"
                      onClick={() => onTabChange(tab.id)}
                      data-testid={`tab-${tab.id}`}
                      style={{
                        background: isActive ? 'var(--accent-soft)' : 'transparent',
                        color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                      }}
                      className={`
                        group relative w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left text-[13px] font-medium
                        transition-all duration-150 ease-out
                        hover:[background:var(--bg-subtle)] hover:[color:var(--text-primary)]
                        hover:translate-x-0.5
                      `}
                    >
                      {isActive && (
                        <span
                          className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full"
                          style={{ background: 'var(--accent)' }}
                        />
                      )}
                      <Icon className="w-4 h-4" strokeWidth={2} />
                      <span>{tab.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Theme toggle */}
      <div className="p-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <ThemeToggle />
      </div>
    </nav>
  );
}
