import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({ pageCount, currentPage, onPageChange }) {
  if (pageCount <= 1) return null;

  const handlePrev = () => { if (currentPage > 0) onPageChange(currentPage - 1); };
  const handleNext = () => { if (currentPage < pageCount - 1) onPageChange(currentPage + 1); };

  const pages = [];
  const show = 5;
  let start = Math.max(0, currentPage - Math.floor(show / 2));
  let end = Math.min(pageCount, start + show);
  if (end - start < show) start = Math.max(0, end - show);
  for (let i = start; i < end; i++) pages.push(i);

  const btnBase = 'flex items-center justify-center rounded-md text-sm font-medium transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed';
  const inactive = {
    background: 'var(--bg-surface)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-subtle)',
  };
  const active = {
    background: 'var(--accent)',
    color: '#fff',
    border: '1px solid var(--accent)',
  };

  return (
    <nav className="flex items-center gap-1.5 flex-wrap mt-4" aria-label="Table pagination">
      <button
        type="button"
        onClick={handlePrev}
        disabled={currentPage === 0}
        aria-label="Previous page"
        style={inactive}
        className={`${btnBase} w-8 h-8 hover:[background:var(--bg-subtle)]`}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <ul className="flex list-none p-0 m-0 gap-1">
        {pages.map((p) => (
          <li key={p}>
            <button
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === currentPage ? 'page' : undefined}
              style={p === currentPage ? active : inactive}
              className={`${btnBase} min-w-8 h-8 px-2 ${p === currentPage ? '' : 'hover:[background:var(--bg-subtle)]'}`}
            >
              {p + 1}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={handleNext}
        disabled={currentPage >= pageCount - 1}
        aria-label="Next page"
        style={inactive}
        className={`${btnBase} w-8 h-8 hover:[background:var(--bg-subtle)]`}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </nav>
  );
}
