import React, { useState, useEffect, useRef } from 'react';
import { Terminal, ChevronDown, ChevronUp } from 'lucide-react';
import { getLogs } from '../api/client';

export function LogsPanel({ isActive }) {
  const [lines, setLines] = useState([]);
  const [open, setOpen] = useState(true);
  const preRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    if (!isActive) return;
    const poll = () => {
      getLogs()
        .then((data) => {
          const combined = [
            ...(data.stdout || []).map((t) => ({ type: 'stdout', text: t })),
            ...(data.stderr || []).map((t) => ({ type: 'stderr', text: t })),
          ];
          setLines(combined);
        })
        .catch(() => {});
      pollRef.current = setTimeout(poll, 2000);
    };
    poll();
    return () => clearTimeout(pollRef.current);
  }, [isActive]);

  useEffect(() => {
    if (preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight;
  }, [lines]);

  if (lines.length === 0 && !isActive) return null;

  return (
    <div className="w-full animate-fade-in mb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ color: 'var(--text-secondary)' }}
        className="flex items-center gap-2 text-sm font-medium transition-colors mb-2 hover:[color:var(--text-primary)]"
      >
        <Terminal className="w-4 h-4" />
        <span>Live Logs</span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {lines.length > 0 && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
            style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
          >
            {lines.length}
          </span>
        )}
      </button>
      {open && (
        <div
          className="rounded-[10px] overflow-hidden"
          style={{
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <pre
            ref={preRef}
            className="p-4 text-xs font-mono leading-relaxed max-h-[28rem] overflow-y-auto m-0"
            style={{ color: 'var(--text-secondary)' }}
          >
            {lines.length === 0 ? (
              <span style={{ color: 'var(--text-muted)' }}>Waiting for logs...</span>
            ) : (
              lines.map((line, i) => (
                <div
                  key={i}
                  style={{
                    color: line.type === 'stderr' ? 'var(--danger)' : 'var(--text-secondary)',
                    paddingLeft: line.type === 'stderr' ? '6px' : '0',
                    borderLeft: line.type === 'stderr' ? '2px solid var(--danger)' : 'none',
                  }}
                >
                  {line.text}
                </div>
              ))
            )}
          </pre>
        </div>
      )}
    </div>
  );
}
