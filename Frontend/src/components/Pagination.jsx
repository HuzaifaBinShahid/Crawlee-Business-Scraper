import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({ pageCount, currentPage, onPageChange }) {
  if (pageCount <= 1) return null;

  const handlePrev = () => {
    if (currentPage > 0) onPageChange(currentPage - 1);
  };

  const handleNext = () => {
    if (currentPage < pageCount - 1) onPageChange(currentPage + 1);
  };

  const pages = [];
  const show = 5;
  let start = Math.max(0, currentPage - Math.floor(show / 2));
  let end = Math.min(pageCount, start + show);
  if (end - start < show) start = Math.max(0, end - show);
  for (let i = start; i < end; i++) pages.push(i);

  return (
    <nav className="flex items-center gap-2 flex-wrap mt-4" aria-label="Table pagination">
      <button
        type="button"
        onClick={handlePrev}
        disabled={currentPage === 0}
        aria-label="Previous page"
        className="p-2 rounded-lg border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <ul className="flex list-none p-0 m-0 gap-1">
        {pages.map((p) => (
          <li key={p}>
            <button
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === currentPage ? 'page' : undefined}
              className={`
                min-w-[2.25rem] py-2 px-2.5 rounded-lg text-sm font-medium transition-all duration-200
                ${p === currentPage
                  ? 'bg-slate-600 text-white shadow-sm border border-slate-500'
                  : 'border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
                }
              `}
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
        className="p-2 rounded-lg border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </nav>
  );
}
