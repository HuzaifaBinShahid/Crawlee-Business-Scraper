import React from 'react';

/**
 * Inline alert with a left accent stripe — Linear/Vercel style.
 * Variants: success, danger, warning, info.
 */

const VARIANTS = {
  success: { bar: 'var(--success)', bg: 'var(--bg-surface)', icon: 'var(--success)' },
  danger:  { bar: 'var(--danger)',  bg: 'var(--bg-surface)', icon: 'var(--danger)' },
  warning: { bar: 'var(--warning)', bg: 'var(--bg-surface)', icon: 'var(--warning)' },
  info:    { bar: 'var(--info)',    bg: 'var(--bg-surface)', icon: 'var(--info)' },
};

export function Banner({ icon: Icon, variant = 'info', title, children, onClose }) {
  const c = VARIANTS[variant] || VARIANTS.info;
  return (
    <div
      className="relative mt-4 rounded-[8px] overflow-hidden animate-fade-in-up"
      style={{
        background: c.bg,
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)',
      }}
      role="status"
    >
      {/* Left accent stripe */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: c.bar }}
      />
      <div className="flex items-start gap-2.5 pl-4 pr-3 py-2.5">
        {Icon && (
          <span
            className="flex-shrink-0 mt-0.5 rounded-full p-1"
            style={{ background: `color-mix(in srgb, ${c.icon} 12%, transparent)`, color: c.icon }}
          >
            <Icon className="w-3.5 h-3.5" strokeWidth={2.5} />
          </span>
        )}
        <div className="flex-1 min-w-0">
          {title && (
            <div className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
              {title}
            </div>
          )}
          <div
            className={`text-[13px] ${title ? 'mt-0.5' : ''}`}
            style={{ color: title ? 'var(--text-secondary)' : 'var(--text-primary)' }}
          >
            {children}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="flex-shrink-0 text-xs font-medium opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Dismiss"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
