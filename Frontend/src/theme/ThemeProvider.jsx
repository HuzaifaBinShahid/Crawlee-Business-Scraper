import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const ThemeContext = createContext({ theme: 'light', setTheme: () => {}, toggle: () => {} });

const STORAGE_KEY = 'theme';

function readInitial() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch (_) {}
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readInitial);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (_) {}
  }, [theme]);

  const setTheme = useCallback((t) => setThemeState(t === 'dark' ? 'dark' : 'light'), []);
  const toggle = useCallback(() => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')), []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
