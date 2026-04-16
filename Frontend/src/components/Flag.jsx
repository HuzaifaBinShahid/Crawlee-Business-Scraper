import React from 'react';

/**
 * Inline SVG flags — work on every platform (Windows/Linux/macOS) regardless of
 * emoji rendering support. Based on public domain flag designs.
 */

const FLAG_GB = (
  <svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <clipPath id="flag-gb-a"><path d="M0 0v30h60V0z" /></clipPath>
    <clipPath id="flag-gb-b"><path d="M30 15h30v15zv15H0zH0V0zV0h30z" /></clipPath>
    <g clipPath="url(#flag-gb-a)">
      <path d="M0 0v30h60V0z" fill="#012169" />
      <path d="M0 0l60 30m0-30L0 30" stroke="#fff" strokeWidth="6" />
      <path d="M0 0l60 30m0-30L0 30" clipPath="url(#flag-gb-b)" stroke="#C8102E" strokeWidth="4" />
      <path d="M30 0v30M0 15h60" stroke="#fff" strokeWidth="10" />
      <path d="M30 0v30M0 15h60" stroke="#C8102E" strokeWidth="6" />
    </g>
  </svg>
);

const FLAG_FR = (
  <svg viewBox="0 0 3 2" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="1" height="2" x="0" fill="#002654" />
    <rect width="1" height="2" x="1" fill="#ffffff" />
    <rect width="1" height="2" x="2" fill="#ED2939" />
  </svg>
);

const FLAG_PK = (
  <svg viewBox="0 0 900 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="900" height="600" fill="#01411C" />
    <rect width="225" height="600" fill="#ffffff" />
    <circle cx="563" cy="300" r="125" fill="#01411C" />
    <circle cx="595" cy="272" r="115" fill="#ffffff" />
    <path
      fill="#ffffff"
      d="M674 344l-29-43-45 23 9-50-44-28 49-9 15-48 27 42 49-7-25 44 43 32-49 10z"
    />
  </svg>
);

const FLAG_SA = (
  <svg viewBox="0 0 900 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="900" height="600" fill="#006C35" />
    {/* Simplified Shahada calligraphy representation */}
    <g fill="#ffffff">
      <rect x="150" y="180" width="600" height="14" rx="4" />
      <rect x="180" y="210" width="540" height="14" rx="4" />
      <rect x="210" y="240" width="480" height="14" rx="4" />
      {/* Simplified sword */}
      <rect x="180" y="380" width="540" height="10" rx="5" />
      <path d="M720 385 l30 0 l-20 -10 z" />
      <rect x="150" y="378" width="30" height="14" rx="3" />
    </g>
  </svg>
);

const FLAG_GLOBE = (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </svg>
);

const MAP = {
  UK: FLAG_GB,   // UK scraper code maps to the GB flag
  GB: FLAG_GB,
  FR: FLAG_FR,
  PK: FLAG_PK,
  SA: FLAG_SA,
  ALL: FLAG_GLOBE,
};

export function Flag({ code, size = 16, className = '', style }) {
  const flag = MAP[(code || '').toUpperCase()] || MAP.ALL;
  const w = size;
  const h = Math.round(size * 0.67); // 3:2 aspect for most flags
  return (
    <span
      className={`inline-block overflow-hidden rounded-[2px] flex-shrink-0 ${className}`}
      style={{
        width: `${w}px`,
        height: `${h}px`,
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
        ...style,
      }}
    >
      {React.cloneElement(flag, { width: w, height: h })}
    </span>
  );
}
