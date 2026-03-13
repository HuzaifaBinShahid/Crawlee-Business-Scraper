import React from 'react';

export function Select({ label, value, onChange, options, id, placeholder = 'Select...' }) {
  const selectId = id || `select-${label?.replace(/\s/g, '-') || Math.random().toString(36).slice(2)}`;
  return (
    <div className="mb-4">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-slate-300 mb-2">
          {label}
        </label>
      )}
      <select
        id={selectId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="
          w-full px-4 py-3 text-sm rounded-xl
          border border-slate-600 bg-slate-800 text-stone-200 font-medium
          focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500
          transition-all duration-200 hover:border-slate-500
          appearance-none cursor-pointer
        "
        style={{
          background: `#1e293b url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E") no-repeat right 0.75rem center/1.25rem`,
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={typeof opt === 'object' ? opt.value : opt} value={typeof opt === 'object' ? opt.value : opt}>
            {typeof opt === 'object' ? opt.label : opt}
          </option>
        ))}
      </select>
    </div>
  );
}
