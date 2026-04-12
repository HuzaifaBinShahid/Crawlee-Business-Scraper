import React, { useState, useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';
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
    if (preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [lines]);

  if (lines.length === 0 && !isActive) return null;

  return (
    <div className="w-full animate-fade-in mb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors mb-2"
      >
        <Terminal className="w-4 h-4" />
        <span>Live Logs {open ? '(hide)' : '(show)'}</span>
        {lines.length > 0 && (
          <span className="text-xs bg-slate-700 px-2 py-0.5 rounded-full">{lines.length} lines</span>
        )}
      </button>
      {open && (
        <div className="bg-slate-950 border border-slate-700 rounded-xl overflow-hidden">
          <pre
            ref={preRef}
            className="p-4 text-xs font-mono leading-relaxed max-h-[28rem] overflow-y-auto scrollbar-thin"
          >
            {lines.length === 0 ? (
              <span className="text-slate-500">Waiting for logs...</span>
            ) : (
              lines.map((line, i) => (
                <div key={i} className={line.type === 'stderr' ? 'text-red-400' : 'text-slate-300'}>
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
