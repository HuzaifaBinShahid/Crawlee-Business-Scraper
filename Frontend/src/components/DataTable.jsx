import React from 'react';
import { Database } from 'lucide-react';

export function DataTable({ columns, rows }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-600 -mx-px">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="bg-slate-700/80 border-b border-slate-600">
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-3 font-semibold text-slate-300">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="p-0 align-top">
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center border-b border-slate-700/80">
                  <div className="rounded-full bg-slate-700/80 p-5 mb-4 ring-4 ring-slate-600/50">
                    <Database className="w-12 h-12 text-slate-500" strokeWidth={1.5} aria-hidden />
                  </div>
                  <p className="text-slate-300 font-medium text-base">No data</p>
                  <p className="text-slate-500 text-sm mt-1 max-w-xs">Run the scraper from Collect Data to see businesses here.</p>
                </div>
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr
                key={row.uniqueId || idx}
                className="border-b border-slate-700/80 hover:bg-slate-700/50 transition-colors duration-150"
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-slate-300">
                    {col.render ? col.render(row[col.key], row) : row[col.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
