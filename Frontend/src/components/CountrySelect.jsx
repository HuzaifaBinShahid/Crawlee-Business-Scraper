import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Flag } from './Flag';

/**
 * Custom country dropdown with inline SVG flags + full name.
 * Drop-in replacement for the generic Select where a country picker is needed.
 */

const COUNTRIES = [
  { value: 'UK', name: 'United Kingdom' },
  { value: 'FR', name: 'France' },
  { value: 'PK', name: 'Pakistan' },
  { value: 'SA', name: 'Saudi Arabia' },
];

export const COUNTRY_META = Object.fromEntries(COUNTRIES.map((c) => [c.value, c]));

export function CountrySelect({ label, value, onChange, includeAll = false, id = 'country-select', disabled = false, ...rest }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const options = includeAll
    ? [{ value: '', name: 'All countries' }, ...COUNTRIES]
    : COUNTRIES;
  const current = options.find((c) => c.value === value) || (includeAll ? options[0] : null);

  return (
    <div className="mb-1">
      {label && (
        <label htmlFor={id} className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </label>
      )}
      <div ref={rootRef} className="relative">
        <button
          id={id}
          type="button"
          onClick={() => !disabled && setOpen((v) => !v)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          {...rest}
          style={{
            background: 'var(--bg-surface)',
            border: `1px solid ${open ? 'var(--accent)' : 'var(--border-subtle)'}`,
            color: 'var(--text-primary)',
            boxShadow: open ? '0 0 0 3px var(--accent-soft)' : 'none',
          }}
          className="w-full flex items-center justify-between gap-2 pl-3 pr-2.5 py-2 rounded-md text-sm font-medium transition-all duration-150 ease-out disabled:opacity-50 disabled:cursor-not-allowed hover:[border-color:var(--border-strong)]"
        >
          <span className="flex items-center gap-2.5 min-w-0">
            {current && <Flag code={current.value || 'ALL'} size={20} />}
            <span className="truncate">{current ? current.name : 'Select country'}</span>
          </span>
          <ChevronDown
            className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            style={{ color: 'var(--text-muted)' }}
          />
        </button>

        {open && (
          <div
            role="listbox"
            className="absolute z-20 mt-1 left-0 right-0 rounded-md overflow-hidden animate-fade-in-up"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div className="max-h-64 overflow-y-auto py-1">
            {options.map((opt) => {
              const selected = opt.value === value;
              return (
                <button
                  key={opt.value || 'all'}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  style={{
                    background: selected ? 'var(--accent-soft)' : 'transparent',
                    color: selected ? 'var(--accent)' : 'var(--text-primary)',
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors duration-100 hover:[background:var(--bg-subtle)]"
                >
                  <Flag code={opt.value || 'ALL'} size={20} />
                  <span className="flex-1 truncate">{opt.name}</span>
                  {!includeAll && opt.value && (
                    <span className="text-[10px] font-mono opacity-60">{opt.value}</span>
                  )}
                  {selected && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                </button>
              );
            })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
