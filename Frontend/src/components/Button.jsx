import React from 'react';

export function Button({ children, onClick, disabled, variant = 'primary', type = 'button', className = '' }) {
  const isPrimary = variant === 'primary';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
        transition-all duration-200 ease-out
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-slate-500
        disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none
        active:scale-[0.98]
        ${isPrimary
          ? 'bg-slate-600 text-white hover:bg-slate-500 shadow-sm hover:shadow-md'
          : 'bg-slate-700 text-stone-200 border border-slate-600 hover:bg-slate-600'
        }
        ${className}
      `.trim()}
    >
      {children}
    </button>
  );
}
