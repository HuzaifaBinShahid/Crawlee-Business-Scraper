import React from 'react';
import { Check } from 'lucide-react';

export function Checkbox({ label, checked, onChange, id, disabled = false, ...rest }) {
  const cbId = id || `cb-${label?.replace(/\s/g, '-') || Math.random().toString(36).slice(2)}`;
  return (
    <label
      htmlFor={cbId}
      className={`inline-flex items-center gap-2.5 select-none ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className="relative inline-flex items-center justify-center">
        <input
          id={cbId}
          type="checkbox"
          checked={!!checked}
          onChange={(e) => onChange?.(e.target.checked)}
          disabled={disabled}
          {...rest}
          className="peer sr-only"
        />
        <span
          style={{
            background: checked ? 'var(--accent)' : 'var(--bg-surface)',
            border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--border-strong)'}`,
          }}
          className={`
            pointer-events-none
            block w-[18px] h-[18px] rounded-[5px]
            transition-all duration-150 ease-out
            ${checked ? 'animate-tick-bounce' : ''}
          `}
        />
        {checked && (
          <Check
            className="absolute w-[12px] h-[12px] text-white pointer-events-none animate-fade-in"
            strokeWidth={3}
          />
        )}
      </span>
      {label && (
        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{label}</span>
      )}
    </label>
  );
}
