import React from 'react';

const STYLES = {
  primary:   { background: 'var(--accent)',    color: '#fff', border: 'none' },
  secondary: { background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' },
  ghost:     { background: 'transparent',       color: 'var(--text-secondary)', border: 'none' },
  danger:    { background: 'var(--danger)',    color: '#fff', border: 'none' },
};

export function Button({
  children, onClick, disabled, variant = 'primary',
  type = 'button', className = '', size = 'md', ...rest
}) {
  const sizeClass = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';
  const isFilled = variant === 'primary' || variant === 'danger';

  const onMouseEnter = (e) => {
    if (variant === 'primary') e.currentTarget.style.background = 'var(--accent-hover)';
    if (variant === 'secondary' || variant === 'ghost') e.currentTarget.style.background = 'var(--bg-subtle)';
  };
  const onMouseLeave = (e) => {
    e.currentTarget.style.background = STYLES[variant].background;
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      {...rest}
      style={{ ...STYLES[variant], boxShadow: isFilled ? '0 1px 2px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.12)' : undefined }}
      className={`
        group relative inline-flex items-center justify-center gap-2 ${sizeClass} rounded-md font-medium
        transition-all duration-200 ease-out
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
        hover:-translate-y-[1px] hover:shadow-md
        active:translate-y-0 active:scale-[0.98]
        overflow-hidden
        ${className}
      `.trim()}
    >
      {/* Shine sweep effect on hover — only for filled buttons */}
      {isFilled && !disabled && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"
          style={{
            background: 'linear-gradient(110deg, transparent 20%, rgba(255,255,255,0.25) 50%, transparent 80%)',
          }}
        />
      )}
      <span className="relative inline-flex items-center gap-2">{children}</span>
    </button>
  );
}
