import React, { useState } from 'react';

export function TextArea({ label, hint, value, onChange, placeholder, id, rows = 3, disabled = false, mono = false, ...rest }) {
  const inputId = id || `ta-${label?.replace(/\s/g, '-') || Math.random().toString(36).slice(2)}`;
  const [focused, setFocused] = useState(false);
  return (
    <div className="mb-1">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
          {label}
          {hint && <span className="font-normal ml-1.5" style={{ color: 'var(--text-muted)' }}>· {hint}</span>}
        </label>
      )}
      <textarea
        id={inputId}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        {...rest}
        style={{
          background: 'var(--bg-surface)',
          border: `1px solid ${focused ? 'var(--accent)' : 'var(--border-subtle)'}`,
          color: 'var(--text-primary)',
          boxShadow: focused ? '0 0 0 3px var(--accent-soft)' : 'none',
          fontFamily: mono ? 'ui-monospace, monospace' : undefined,
        }}
        className="w-full rounded-md px-3 py-2 text-sm resize-none focus:outline-none transition-all duration-150 disabled:opacity-50 placeholder:text-[color:var(--text-muted)]"
      />
    </div>
  );
}
