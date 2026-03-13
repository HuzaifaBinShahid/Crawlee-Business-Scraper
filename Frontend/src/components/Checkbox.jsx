import React from 'react';

export function Checkbox({ label, checked, onChange, id }) {
  const inputId = id || `cb-${label?.replace(/\s/g, '-') || Math.random().toString(36).slice(2)}`;
  return (
    <div className="flex items-center gap-3 mb-4">
      <input
        type="checkbox"
        id={inputId}
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        className="
          w-5 h-5 rounded border-slate-500 bg-slate-800 text-slate-500
          focus:ring-2 focus:ring-slate-500/40 focus:ring-offset-0 focus:ring-offset-slate-900
          transition-all duration-200 accent-cyan-500
        "
      />
      {label && (
        <label htmlFor={inputId} className="text-sm text-slate-300 cursor-pointer select-none">
          {label}
        </label>
      )}
    </div>
  );
}
