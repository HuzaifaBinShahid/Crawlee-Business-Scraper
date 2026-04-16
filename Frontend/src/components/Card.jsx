import React from 'react';

export function Card({ children, className = '', padded = true, ...rest }) {
  return (
    <div
      {...rest}
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}
      className={`rounded-[10px] ${padded ? 'p-6' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
