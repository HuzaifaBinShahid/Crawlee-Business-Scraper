import React from 'react';
import { Sidebar } from './Sidebar';

export function Layout({ activeTab, onTabChange, children }) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-page)' }}>
      <Sidebar activeTab={activeTab} onTabChange={onTabChange} />
      <main
        className="flex-1 overflow-auto animate-fade-in"
        style={{ background: 'var(--bg-page)' }}
      >
        {children}
      </main>
    </div>
  );
}
