import React, { useState, useEffect, useRef } from 'react';
import { getProgress } from '../api/client';
import { AnimatedNumber } from './AnimatedNumber';

const COUNTERS = [
  { key: 'found', label: 'Found', color: 'var(--info)' },
  { key: 'saved', label: 'Saved', color: 'var(--success)' },
  { key: 'skipped', label: 'Skipped', color: 'var(--text-muted)' },
  { key: 'duplicates', label: 'Duplicates', color: 'var(--warning)' },
  { key: 'failed', label: 'Failed', color: 'var(--danger)' },
];

export function ProgressPanel({ isActive }) {
  const [data, setData] = useState({
    counters: { found: 0, saved: 0, skipped: 0, duplicates: 0, failed: 0 },
    currentTask: null,
  });
  const pollRef = useRef(null);
  const [runtimeMs, setRuntimeMs] = useState(0);
  const startedAtRef = useRef(null);

  useEffect(() => {
    if (!isActive) {
      startedAtRef.current = null;
      setRuntimeMs(0);
      return;
    }
    startedAtRef.current ??= Date.now();
    const poll = () => {
      getProgress().then((d) => setData(d)).catch(() => {});
      pollRef.current = setTimeout(poll, 1500);
    };
    poll();
    const tick = setInterval(() => {
      if (startedAtRef.current) setRuntimeMs(Date.now() - startedAtRef.current);
    }, 1000);
    return () => {
      clearTimeout(pollRef.current);
      clearInterval(tick);
    };
  }, [isActive]);

  const { counters, currentTask } = data;
  const hasActivity = Object.values(counters).some((v) => v > 0) || currentTask;
  if (!isActive && !hasActivity) return null;

  const totalFound = counters.found || 0;
  const saveRate = totalFound > 0 ? Math.round((counters.saved / totalFound) * 100) : 0;
  const elapsed = formatRuntime(runtimeMs);

  return (
    <div className="w-full animate-fade-in mb-4">
      <div
        className="rounded-[12px] overflow-hidden relative"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Live indicator strip (animated gradient bar across top) */}
        {isActive && (
          <div
            className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden"
            style={{ background: 'var(--border-subtle)' }}
          >
            <div
              className="h-full animate-shimmer"
              style={{
                width: '40%',
                background: `linear-gradient(90deg, transparent 0%, var(--accent) 50%, transparent 100%)`,
                backgroundSize: '200% 100%',
              }}
            />
          </div>
        )}

        {/* Header row: live status + runtime */}
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2">
            {isActive && (
              <span className="relative flex items-center justify-center">
                <span
                  className="absolute w-2 h-2 rounded-full animate-ping"
                  style={{ background: 'var(--success)', opacity: 0.5 }}
                />
                <span
                  className="relative w-1.5 h-1.5 rounded-full"
                  style={{ background: 'var(--success)' }}
                />
              </span>
            )}
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: isActive ? 'var(--success)' : 'var(--text-muted)' }}
            >
              {isActive ? 'Live' : 'Last run'}
            </span>
            {currentTask && (
              <>
                <span className="mx-1" style={{ color: 'var(--border-strong)' }}>·</span>
                <span className="text-xs font-medium truncate max-w-[280px]" style={{ color: 'var(--text-secondary)' }}>
                  {[currentTask.country, currentTask.city, currentTask.category].filter(Boolean).join(' / ')}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {totalFound > 0 && (
              <span>
                <span style={{ color: 'var(--success)' }}>{saveRate}%</span> saved
              </span>
            )}
            <span>{elapsed}</span>
          </div>
        </div>

        {/* Counter strip */}
        <div className="grid grid-cols-5 relative" data-testid="progress-counters">
          {COUNTERS.map((c, i) => (
            <div
              key={c.key}
              data-testid={`counter-${c.key}`}
              className="relative px-4 py-4 group"
              style={{
                borderLeft: i > 0 ? '1px solid var(--border-subtle)' : 'none',
              }}
            >
              {/* Colored accent bar — only shows if counter has activity */}
              <div
                className="absolute left-0 top-0 bottom-0 w-[2px] transition-all duration-300"
                style={{
                  background: counters[c.key] > 0 ? c.color : 'transparent',
                  opacity: counters[c.key] > 0 ? 0.9 : 0,
                }}
              />
              <div
                className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-1"
                style={{ color: 'var(--text-muted)' }}
              >
                {c.label}
              </div>
              <div
                className="text-2xl font-semibold tabular-nums leading-tight transition-colors"
                style={{
                  color: counters[c.key] > 0 ? c.color : 'var(--text-primary)',
                }}
              >
                <AnimatedNumber value={counters[c.key] || 0} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatRuntime(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m}m ${rs.toString().padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${(m % 60).toString().padStart(2, '0')}m`;
}
