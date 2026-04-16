import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function Select({ label, value, onChange, options, id, placeholder = 'Select...', disabled = false, ...rest }) {
  const selectId = id || `select-${label?.replace(/\s/g, '-') || Math.random().toString(36).slice(2)}`;
  const [focused, setFocused] = useState(false);
  return (
    <div className="mb-1">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs font-medium mb-1.5"
          style={{ color: 'var(--text-secondary)' }}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={disabled}
          {...rest}
          style={{
            background: 'var(--bg-surface)',
            border: `1px solid ${focused ? 'var(--accent)' : 'var(--border-subtle)'}`,
            color: 'var(--text-primary)',
            boxShadow: focused ? '0 0 0 3px var(--accent-soft)' : 'none',
          }}
          className="w-full appearance-none pl-3 pr-9 py-2 rounded-md text-sm font-medium cursor-pointer transition-all duration-150 ease-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option
              key={typeof opt === 'object' ? opt.value : opt}
              value={typeof opt === 'object' ? opt.value : opt}
            >
              {typeof opt === 'object' ? opt.label : opt}
            </option>
          ))}
        </select>
        <ChevronDown
          className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
          style={{ color: 'var(--text-muted)' }}
        />
      </div>
    </div>
  );
}
