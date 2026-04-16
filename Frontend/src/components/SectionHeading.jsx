import React from 'react';

export function SectionHeading({ eyebrow, title, subtitle, right, className = '' }) {
  return (
    <div className={`mb-6 flex items-start justify-between gap-4 ${className}`}>
      <div className="animate-fade-in-up">
        {eyebrow && (
          <div
            className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] mb-2"
            style={{ color: 'var(--text-muted)' }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: 'var(--accent)' }}
            />
            {eyebrow}
          </div>
        )}
        <h1
          className="font-semibold tracking-tight"
          style={{ color: 'var(--text-primary)', fontSize: '30px', lineHeight: '36px' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {subtitle}
          </p>
        )}
        <div
          className="mt-4 h-[2px] w-8 rounded-full"
          style={{ background: 'var(--accent)' }}
        />
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}
