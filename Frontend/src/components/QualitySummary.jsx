import React, { useState, useEffect } from 'react';
import { getQuality } from '../api/client';

export function QualitySummary({ country }) {
  const [quality, setQuality] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getQuality(country)
      .then(setQuality)
      .catch(() => setQuality(null))
      .finally(() => setLoading(false));
  }, [country]);

  if (loading) return <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading quality summary...</div>;
  if (!quality || quality.total === 0) return null;

  const pctColor = (p) => p >= 80 ? 'var(--success)' : p >= 50 ? 'var(--warning)' : 'var(--danger)';
  const completenessColor = pctColor(quality.completeness);

  // Ring chart (SVG circle) for completeness
  const ringSize = 64;
  const ringStroke = 6;
  const ringR = (ringSize - ringStroke) / 2;
  const ringCirc = 2 * Math.PI * ringR;
  const ringDash = (quality.completeness / 100) * ringCirc;

  return (
    <div
      data-testid="quality-summary"
      className="rounded-[10px] p-6"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
        Data Quality {country ? `— ${country}` : ''}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Total Records" value={quality.total.toLocaleString()} />
        <div
          className="rounded-[10px] p-3 flex items-center gap-3"
          style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}
        >
          <svg width={ringSize} height={ringSize} className="shrink-0">
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={ringR}
              fill="none"
              stroke="var(--border-subtle)"
              strokeWidth={ringStroke}
            />
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={ringR}
              fill="none"
              stroke={completenessColor}
              strokeWidth={ringStroke}
              strokeDasharray={`${ringDash} ${ringCirc}`}
              strokeLinecap="round"
              transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
              style={{ transition: 'stroke-dasharray 500ms ease-out' }}
            />
            <text
              x="50%"
              y="52%"
              dominantBaseline="middle"
              textAnchor="middle"
              fontSize="14"
              fontWeight="600"
              fill="var(--text-primary)"
            >
              {quality.completeness}%
            </text>
          </svg>
          <div>
            <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Completeness</div>
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {quality.completeness >= 80 ? 'Good' : quality.completeness >= 50 ? 'Fair' : 'Poor'}
            </div>
          </div>
        </div>
        <Stat label="Duplicates" value={quality.duplicates} valueColor={quality.duplicates > 0 ? 'var(--warning)' : 'var(--text-primary)'} />
        <Stat label="Incomplete" value={quality.incomplete} valueColor={quality.incomplete > 0 ? 'var(--danger)' : 'var(--text-primary)'} />
      </div>
      {quality.missing && (
        <div>
          <div className="text-[10px] uppercase tracking-wider mb-2 font-semibold" style={{ color: 'var(--text-muted)' }}>
            Missing fields
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(quality.missing).map(([field, count]) => {
              if (count === 0) return null;
              const pct = Math.round((count / quality.total) * 100);
              return (
                <span
                  key={field}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
                  style={{
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>{field}</span>
                  <span style={{ color: pctColor(100 - pct), fontWeight: 600 }}>{pct}%</span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, valueColor = 'var(--text-primary)' }) {
  return (
    <div
      className="rounded-[10px] p-3"
      style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="text-[22px] font-semibold leading-tight" style={{ color: valueColor }}>{value}</div>
      <div className="text-[11px] uppercase tracking-wider mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}
