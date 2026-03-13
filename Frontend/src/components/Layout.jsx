import React from 'react';
import { Sidebar } from './Sidebar';

export function Layout({ activeTab, onTabChange, children }) {
  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar activeTab={activeTab} onTabChange={onTabChange} />
      <main className="flex-1 p-6 md:p-8 overflow-auto animate-fade-in bg-slate-900">
        {children}
      </main>
    </div>
  );
}
