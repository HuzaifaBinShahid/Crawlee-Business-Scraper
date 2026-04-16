import React from 'react';
import { Database } from 'lucide-react';

export function DataTable({ columns, rows }) {
  return (
    <div
      className="overflow-x-auto rounded-[10px]"
      style={{ border: '1px solid var(--border-subtle)' }}
    >
      <table className="w-full text-sm text-left">
        <thead>
          <tr
            style={{
              background: 'var(--bg-subtle)',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-0 align-top">
                <div
                  className="flex flex-col items-center justify-center py-16 px-6 text-center"
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                >
                  <div
                    className="rounded-full p-5 mb-4"
                    style={{ background: 'var(--bg-subtle)' }}
                  >
                    <Database className="w-10 h-10" style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} aria-hidden />
                  </div>
                  <p className="font-medium text-base" style={{ color: 'var(--text-primary)' }}>No data</p>
                  <p className="text-sm mt-1 max-w-xs" style={{ color: 'var(--text-muted)' }}>
                    Run the scraper from Collect Data to see businesses here.
                  </p>
                </div>
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr
                key={row.uniqueId || idx}
                style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--border-subtle)' }}
                className="transition-colors duration-100 hover:[background:var(--bg-subtle)]"
              >
                {columns.map((col) => {
                  let content = col.render ? col.render(row[col.key], row) : row[col.key];
                  if (content != null && typeof content === 'object' && !React.isValidElement(content)) {
                    content = JSON.stringify(content);
                  }
                  if (content == null || content === '') content = '—';
                  return (
                    <td
                      key={col.key}
                      className="px-4 py-3 text-sm"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
