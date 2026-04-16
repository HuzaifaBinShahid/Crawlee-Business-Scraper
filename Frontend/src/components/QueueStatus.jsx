import React, { useState, useEffect, useRef } from 'react';
import { ListOrdered, Loader2 } from 'lucide-react';
import { getQueueStatus } from '../api/client';

export function QueueStatus() {
  const [queue, setQueue] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    const poll = () => {
      getQueueStatus().then((data) => setQueue(data)).catch(() => {});
      pollRef.current = setTimeout(poll, 3000);
    };
    poll();
    return () => clearTimeout(pollRef.current);
  }, []);

  if (!queue || (!queue.isQueueRunning && queue.pendingCount === 0 && !queue.isRunning)) return null;

  return (
    <div className="w-full animate-fade-in">
      <div
        className="rounded-[10px] p-4"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="flex items-center gap-2 text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
          <ListOrdered className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          <span>Queue Status</span>
        </div>

        {queue.currentJobId && queue.currentConfig && (
          <div
            className="flex items-center gap-2 text-sm mb-2 px-2.5 py-1.5 rounded-md"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>
              Running: {queue.currentConfig.country}
              {queue.currentConfig.city && queue.currentConfig.city !== 'all' ? ` / ${queue.currentConfig.city}` : ''}
              {queue.currentConfig.category && queue.currentConfig.category !== 'all' ? ` / ${queue.currentConfig.category}` : ''}
            </span>
          </div>
        )}

        {queue.pendingCount > 0 && (
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{queue.pendingCount}</span>
            {' '}job{queue.pendingCount !== 1 ? 's' : ''} pending:
            <ul className="mt-1 ml-4 space-y-0.5">
              {queue.pending.slice(0, 5).map((p, i) => (
                <li key={i} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {p.country}{p.city !== 'all' ? ` / ${p.city}` : ''}{p.category !== 'all' ? ` / ${p.category}` : ''}
                </li>
              ))}
              {queue.pending.length > 5 && (
                <li className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  ...and {queue.pending.length - 5} more
                </li>
              )}
            </ul>
          </div>
        )}

        {queue.pendingCount === 0 && !queue.isRunning && (
          <div className="text-sm" style={{ color: 'var(--success)' }}>Queue complete.</div>
        )}
      </div>
    </div>
  );
}
