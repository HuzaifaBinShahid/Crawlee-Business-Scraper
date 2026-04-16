import React, { useState } from 'react';
import { Minus, Plus } from 'lucide-react';

export function NumberInput({
  label,
  hint,
  value,
  onChange,
  min = 0,
  max = Infinity,
  step = 1,
  id,
  disabled = false,
  ...rest
}) {
  const inputId = id || `num-${label?.replace(/\s/g, '-') || Math.random().toString(36).slice(2)}`;
  const [focused, setFocused] = useState(false);

  const current = Number(value);
  const atMin = !Number.isNaN(current) && current <= min;
  const atMax = !Number.isNaN(current) && current >= max;

  const clamp = (n) => {
    if (Number.isNaN(n)) return min === -Infinity ? 0 : min;
    return Math.min(max, Math.max(min, n));
  };

  const dec = () => { if (!disabled && !atMin) onChange(clamp(current - step)); };
  const inc = () => { if (!disabled && !atMax) onChange(clamp(current + step)); };

  const btnStyle = {
    color: 'var(--text-secondary)',
    background: 'var(--bg-subtle)',
  };

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
        className="inline-flex items-stretch rounded-md overflow-hidden transition-all duration-150 w-full"
      >
        <button
          type="button"
          onClick={dec}
          disabled={disabled || atMin}
          style={btnStyle}
          className="px-2.5 flex items-center justify-center hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity active:scale-95"
          aria-label="Decrease"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <input
          id={inputId}
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          min={min}
          max={max === Infinity ? undefined : max}
          step={step}
          disabled={disabled}
          {...rest}
          style={{ color: 'var(--text-primary)', background: 'transparent' }}
          className="flex-1 min-w-0 text-center text-sm font-medium py-2 focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={inc}
          disabled={disabled || atMax}
          style={btnStyle}
          className="px-2.5 flex items-center justify-center hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity active:scale-95"
          aria-label="Increase"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
