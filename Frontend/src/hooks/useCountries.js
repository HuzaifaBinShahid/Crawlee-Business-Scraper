import { useState, useEffect, useCallback } from 'react';
import { getCountries } from '../api/client';

/**
 * Module-level cache so multiple consumers of useCountries share the same data
 * and one admin add/remove update in SettingsTab propagates instantly to the
 * country dropdowns in Run, Data, and History tabs.
 */
let cache = null;
let listeners = [];

function notify(next) {
  cache = next;
  listeners.forEach((cb) => cb(next));
}

export async function refreshCountries() {
  try {
    const list = await getCountries();
    notify(Array.isArray(list) ? list : []);
  } catch (_) {
    notify([]);
  }
  return cache;
}

export function useCountries() {
  const [countries, setCountries] = useState(cache || []);
  const [loading, setLoading] = useState(!cache);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { await refreshCountries(); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!cache) refresh();
    const cb = (next) => setCountries(next);
    listeners.push(cb);
    return () => { listeners = listeners.filter((x) => x !== cb); };
  }, [refresh]);

  return { countries, loading, refresh };
}

/** Codes whose scraper field is "nationwide" (or anything other than "grocery"). */
export function nationwideCodes(countries) {
  return (countries || []).filter((c) => c.scraper !== 'grocery').map((c) => c.code);
}
