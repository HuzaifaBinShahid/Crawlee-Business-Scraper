import React, { useState, useEffect } from 'react';
import { RefreshCw, Trash2, RotateCcw, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';
import { SectionHeading } from './SectionHeading';
import { Flag } from './Flag';
import { getHistory, clearHistory, retryJob, getFailed } from '../api/client';

const COUNTRY_NAME = { UK: 'United Kingdom', FR: 'France', PK: 'Pakistan', SA: 'Saudi Arabia' };

function formatDuration(start, end) {
  if (!start || !end) return '—';
  const sec = Math.floor((end - start) / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const s = sec % 60;
  if (min < 60) return `${min}m ${s}s`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}m`;
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  // DD/MM/YYYY, h:mm:ss AM/PM
  const date = d.toLocaleDateString('en-GB'); // DD/MM/YYYY
  const time = d.toLocaleTimeString('en-US', { hour12: true, hour: 'numeric', minute: '2-digit', second: '2-digit' });
  return `${date}, ${time}`;
}

function StatusPill({ status }) {
  const map = {
    completed:   { bg: 'var(--success-soft)', fg: 'var(--success)', icon: CheckCircle, label: 'Done' },
    failed:      { bg: 'var(--danger-soft)',  fg: 'var(--danger)',  icon: XCircle,      label: 'Failed' },
    running:     { bg: 'var(--info-soft)',    fg: 'var(--info)',    icon: Clock,        label: 'Running' },
    interrupted: { bg: 'var(--warning-soft)', fg: 'var(--warning)', icon: XCircle,      label: 'Interrupted' },
  };
  const c = map[status] || map.failed;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ background: c.bg, color: c.fg }}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: c.fg }} />
      {c.label}
    </span>
  );
}

export function HistoryTab() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failedMap, setFailedMap] = useState({});
  const [retryMessage, setRetryMessage] = useState(null);

  const load = () => {
    setLoading(true);
    getHistory()
      .then(async (data) => {
        setHistory(Array.isArray(data) ? data : []);
        const failedEntries = {};
        for (const h of (data || []).slice(0, 10)) {
          if ((h.counters?.failed || 0) > 0) {
            try { failedEntries[h.jobId] = await getFailed(h.jobId); } catch (_) { }
          }
        }
        setFailedMap(failedEntries);
      })
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleClear = () => {
    if (!confirm('Clear all history? This cannot be undone.')) return;
    clearHistory().then(load);
  };

  const handleRetry = (jobId) => {
    setRetryMessage(null);
    retryJob(jobId)
      .then(({ jobId: newId }) => setRetryMessage(`Retry started as job #${newId}`))
      .catch((err) => setRetryMessage(`Retry failed: ${err.message}`));
  };

  return (
    <div className="py-8 px-6 md:px-8 animate-fade-in">
      <SectionHeading
        eyebrow="System · History"
        title="Run History"
        subtitle="Previous scrape runs with results and retry options."
        right={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={load}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {history.length > 0 && (
              <Button variant="secondary" onClick={handleClear}>
                <Trash2 className="w-4 h-4" />
                Clear
              </Button>
            )}
          </div>
        }
      />

      {retryMessage && (
        <div
          className="mb-4 px-3 py-2 rounded-md text-sm"
          style={{ background: 'var(--info-soft)', color: 'var(--info)' }}
        >
          {retryMessage}
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
      ) : history.length === 0 ? (
        <Card>
          <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>No runs yet.</div>
        </Card>
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto" data-testid="history-table">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col style={{ width: '120px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '120px' }} />
                <col style={{ width: '180px' }} />
                <col style={{ width: '80px' }} />
                <col style={{ width: '80px' }} />
                <col style={{ width: '200px' }} />
                <col style={{ width: '100px' }} />
                <col />
              </colgroup>
              <thead
                style={{
                  background: 'var(--bg-subtle)',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <tr>
                  <Th>Status</Th>
                  <Th>Country</Th>
                  <Th>City</Th>
                  <Th>Category</Th>
                  <Th align="right">Saved</Th>
                  <Th align="right">Failed</Th>
                  <Th>Started</Th>
                  <Th>Duration</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr
                    key={i}
                    data-testid="history-row"
                    style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)' }}
                    className="transition-colors hover:[background:var(--bg-subtle)]"
                  >
                    <Td><StatusPill status={h.status} /></Td>
                    <Td>
                      {h.country ? (
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                          <Flag code={h.country} size={16} />
                          <span>{h.country}</span>
                        </span>
                      ) : '—'}
                    </Td>
                    <Td className="truncate">{h.city || 'all'}</Td>
                    <Td className="truncate">{h.category || 'all'}</Td>
                    <Td align="right" color="var(--success)" weight="600">{h.counters?.saved ?? 0}</Td>
                    <Td align="right" color="var(--danger)" weight="600">{h.counters?.failed ?? 0}</Td>
                    <Td color="var(--text-muted)" size="xs" className="whitespace-nowrap">{formatDate(h.startTime)}</Td>
                    <Td color="var(--text-muted)" size="xs" className="whitespace-nowrap">{formatDuration(h.startTime, h.endTime)}</Td>
                    <Td align="right">
                      {(h.counters?.failed || 0) > 0 && (failedMap[h.jobId]?.length || 0) > 0 && (
                        <button
                          onClick={() => handleRetry(h.jobId)}
                          data-testid="retry-btn"
                          style={{ color: 'var(--warning)' }}
                          className="inline-flex items-center gap-1 text-xs font-medium hover:opacity-80 transition-opacity whitespace-nowrap"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Retry {failedMap[h.jobId]?.length || 0}
                        </button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function Th({ children, align = 'left' }) {
  return (
    <th
      className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-${align}`}
      style={{ color: 'var(--text-muted)' }}
    >
      {children}
    </th>
  );
}

function Td({ children, align = 'left', color = 'var(--text-primary)', weight = '400', size = 'sm', className = '' }) {
  return (
    <td
      className={`px-4 py-3 text-${size} text-${align} ${className}`}
      style={{ color, fontWeight: weight }}
    >
      {children}
    </td>
  );
}
