import React, { useState } from 'react';

export function TextInput({ label, hint, value, onChange, placeholder, id, leftIcon, disabled = false, ...rest }) {
  const inputId = id || `inp-${label?.replace(/\s/g, '-') || Math.random().toString(36).slice(2)}`;
  const [focused, setFocused] = useState(false);
  return (
    <div className="mb-1">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
          {label}
          {hint && <span className="font-normal ml-1.5" style={{ color: 'var(--text-muted)' }}>· {hint}</span>}
        </label>
      )}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: `1px solid ${focused ? 'var(--accent)' : 'var(--border-subtle)'}`,
          boxShadow: focused ? '0 0 0 3px var(--accent-soft)' : 'none',
        }}
        className="relative flex items-center rounded-md transition-all duration-150"
      >
        {leftIcon && (
          <span className="pl-3 flex items-center" style={{ color: 'var(--text-muted)' }}>
            {leftIcon}
          </span>
        )}
        <input
          id={inputId}
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          {...rest}
          style={{ color: 'var(--text-primary)', background: 'transparent' }}
          className="flex-1 min-w-0 px-3 py-2 text-sm focus:outline-none disabled:opacity-50 placeholder:text-[color:var(--text-muted)]"
        />
      </div>
    </div>
  );
}
