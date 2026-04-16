import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../theme/ThemeProvider';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      data-testid="theme-toggle"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        color: 'var(--text-secondary)',
      }}
      className="w-full inline-flex items-center justify-between gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all duration-150 hover:[background:var(--bg-subtle)] hover:[color:var(--text-primary)] active:scale-[0.98]"
    >
      <span className="flex items-center gap-2">
        {isDark ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
        <span>{isDark ? 'Dark' : 'Light'}</span>
      </span>
      <span
        className="relative inline-flex w-8 h-4 rounded-full transition-colors duration-200"
        style={{ background: isDark ? 'var(--accent)' : 'var(--border-strong)' }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform duration-200"
          style={{ transform: isDark ? 'translateX(16px)' : 'translateX(0)' }}
        />
      </span>
    </button>
  );
}
