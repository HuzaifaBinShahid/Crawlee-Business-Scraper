import React, { useState, useEffect, useRef } from 'react';
import { ListOrdered, Loader2 } from 'lucide-react';
import { getQueueStatus } from '../api/client';

export function QueueStatus() {
  const [queue, setQueue] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    const poll = () => {
      getQueueStatus()
        .then((data) => setQueue(data))
        .catch(() => {});
      pollRef.current = setTimeout(poll, 3000);
    };

    poll();
    return () => clearTimeout(pollRef.current);
  }, []);

  if (!queue || (!queue.isQueueRunning && queue.pendingCount === 0 && !queue.isRunning)) return null;

  return (
    <div className="mt-4 w-full max-w-lg mx-auto px-4 animate-fade-in">
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-200 mb-3">
          <ListOrdered className="w-4 h-4" />
          <span>Queue Status</span>
        </div>

        {queue.currentJobId && queue.currentConfig && (
          <div className="flex items-center gap-2 text-sm text-sky-300 mb-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>
              Running: {queue.currentConfig.country}
              {queue.currentConfig.city && queue.currentConfig.city !== 'all' ? ` / ${queue.currentConfig.city}` : ''}
              {queue.currentConfig.category && queue.currentConfig.category !== 'all' ? ` / ${queue.currentConfig.category}` : ''}
            </span>
          </div>
        )}

        {queue.pendingCount > 0 && (
          <div className="text-sm text-slate-400">
            <span className="text-slate-300">{queue.pendingCount}</span> job{queue.pendingCount !== 1 ? 's' : ''} pending:
            <ul className="mt-1 ml-4 space-y-0.5">
              {queue.pending.slice(0, 5).map((p, i) => (
                <li key={i} className="text-xs text-slate-500">
                  {p.country}{p.city !== 'all' ? ` / ${p.city}` : ''}{p.category !== 'all' ? ` / ${p.category}` : ''}
                </li>
              ))}
              {queue.pending.length > 5 && (
                <li className="text-xs text-slate-600">...and {queue.pending.length - 5} more</li>
              )}
            </ul>
          </div>
        )}

        {queue.pendingCount === 0 && !queue.isRunning && (
          <div className="text-sm text-emerald-400">Queue complete.</div>
        )}
      </div>
    </div>
  );
}
