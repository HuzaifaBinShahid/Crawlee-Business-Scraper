import React, { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw, Download, ArrowUp, ArrowDown, RotateCcw, ExternalLink } from 'lucide-react';
import { getData, getCategories, downloadUrl, getAllFailed, retryJob } from '../api/client';
import { DataTable } from './DataTable';
import { Pagination } from './Pagination';
import { Button } from './Button';
import { Select } from './Select';
import { CountrySelect } from './CountrySelect';
import { CategorySelect } from './CategorySelect';
import { TextInput } from './TextInput';
import { Flag } from './Flag';
import { useCountries } from '../hooks/useCountries';
import { Card } from './Card';
import { SectionHeading } from './SectionHeading';

const PAGE_SIZE = 25;

const FILTER_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'duplicates', label: 'Duplicates' },
  { key: 'incomplete', label: 'Incomplete' },
  { key: 'failed', label: 'Failed' },
];

const DOWNLOAD_FORMATS = ['csv', 'json', 'ndjson'];

export function DataTab() {
  const { countries } = useCountries();
  const countryName = (code) => countries.find((c) => c.code === code)?.name || code;
  const [data, setData] = useState([]);
  const [failedRecords, setFailedRecords] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [countryFilter, setCountryFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(0);
  const [retryMsg, setRetryMsg] = useState(null);

  const viewingFailed = filterType === 'failed';

  const fetchData = () => {
    setLoading(true);
    setError(null);
    if (viewingFailed) {
      // Dedicated failed-records endpoint — different shape from regular data
      Promise.all([getAllFailed(), getCategories()])
        .then(([failedRes, catRes]) => {
          setFailedRecords(Array.isArray(failedRes) ? failedRes : []);
          setCategories(Array.isArray(catRes) ? catRes : []);
        })
        .catch((err) => { setError(err.message || 'Failed to load failed records'); setFailedRecords([]); })
        .finally(() => setLoading(false));
      return;
    }
    const opts = {};
    if (countryFilter) opts.country = countryFilter;
    if (filterType && filterType !== 'all') opts.filter = filterType;
    if (search) opts.search = search;
    Promise.all([getData(opts), getCategories()])
      .then(([dataRes, catRes]) => {
        setData(Array.isArray(dataRes.data) ? dataRes.data : []);
        setCategories(Array.isArray(catRes) ? catRes : []);
      })
      .catch((err) => { setError(err.message || 'Failed to load data'); setData([]); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [countryFilter, filterType]);

  useEffect(() => {
    if (viewingFailed) return; // search is disabled in failed view
    const timer = setTimeout(fetchData, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const handleRetryJob = (jobId) => {
    setRetryMsg(null);
    retryJob(jobId)
      .then(({ jobId: newId }) => setRetryMsg(`Retry started as job #${newId}`))
      .catch((err) => setRetryMsg(`Retry failed: ${err.message}`));
  };

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const filteredRows = useMemo(() => {
    let list = data;
    if (categoryFilter) {
      const want = categoryFilter.toLowerCase();
      // Match across every schema: client-spec `category`, legacy `category_raw`, old `category`
      list = list.filter((r) => {
        const cat = (r.category || r.category_raw || '').toLowerCase();
        return cat === want;
      });
    }
    list = [...list].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return list;
  }, [data, categoryFilter, sortKey, sortDir]);

  const pageCount = Math.ceil(filteredRows.length / PAGE_SIZE) || 1;
  const paginatedRows = useMemo(() => filteredRows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE), [filteredRows, page]);
  useEffect(() => { if (page >= pageCount && page > 0) setPage(pageCount - 1); }, [pageCount, page]);

  const SortHeader = ({ k, label }) => (
    <button
      onClick={() => toggleSort(k)}
      className="inline-flex items-center gap-1 hover:[color:var(--accent)] transition-colors"
      style={{ color: sortKey === k ? 'var(--accent)' : 'var(--text-muted)' }}
      data-testid={`sort-${k}`}
    >
      {label}
      {sortKey === k && (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
    </button>
  );

  const formatAddress = (v, row) => {
    if (!v) {
      const parts = [row.street, row.city, row.zipCode, row.state, row.country_code || row.country].filter(Boolean);
      return parts.length ? parts.join(', ') : '—';
    }
    if (typeof v === 'string') return v;
    if (typeof v === 'object') {
      const parts = [v.street, v.city, v.zipCode, v.state, v.country].filter(Boolean);
      return parts.length ? parts.join(', ') : '—';
    }
    return String(v);
  };
  const safe = (v) => (v == null || v === '') ? '—' : (typeof v === 'object' ? JSON.stringify(v) : String(v));

  const COLUMNS = [
    { key: 'external_id', label: <SortHeader k="external_id" label="ID" />, render: (v, row) => v || row.uniqueId || '—' },
    { key: 'name', label: <SortHeader k="name" label="Name" />, render: (_, row) => row.name || row.businessName || '—' },
    { key: 'category', label: <SortHeader k="category" label="Category" />, render: (v, row) => safe(v || row.category_raw) },
    { key: 'city', label: <SortHeader k="city" label="City" />, render: (v, row) => safe(v || row.address?.city) },
    {
      key: 'country_code',
      label: <SortHeader k="country_code" label="Country" />,
      render: (v, row) => {
        const code = String(v || row.address?.country || row.country || '').toUpperCase();
        if (!code) return '—';
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <Flag code={code} size={18} />
            <span>{countryName(code)}</span>
          </span>
        );
      },
    },
    { key: 'phone', label: 'Phone', render: (v, row) => safe(v || row.contact?.phone) },
    { key: 'address', label: 'Address', render: formatAddress },
    {
      key: 'website', label: 'Website',
      render: (_, row) => {
        const url = row.website || row.contact?.website;
        if (!url) return '—';
        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent)' }}
            className="underline underline-offset-2 hover:opacity-80"
          >
            {url.length > 30 ? url.slice(0, 30) + '…' : url}
          </a>
        );
      },
    },
    { key: 'rating', label: <SortHeader k="rating" label="Rating" />, render: (v) => v ?? '—' },
    { key: 'review_count', label: <SortHeader k="review_count" label="Reviews" />, render: (v, row) => v ?? row.reviewCount ?? '—' },
  ];

  return (
    <div className="py-8 px-6 md:px-8 animate-fade-in">
      <SectionHeading
        eyebrow="Dataset · Records"
        title="Data"
        subtitle={`${filteredRows.length.toLocaleString()} record${filteredRows.length === 1 ? '' : 's'} matching current filters`}
        right={
          <Button variant="secondary" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {FILTER_CHIPS.map((chip) => {
          const active = filterType === chip.key;
          return (
            <button
              key={chip.key}
              onClick={() => { setFilterType(chip.key); setPage(0); }}
              data-testid={`filter-${chip.key}`}
              style={{
                background: active ? 'var(--accent-soft)' : 'var(--bg-surface)',
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                border: `1px solid ${active ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
              }}
              className="px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 active:scale-95 hover:[background:var(--bg-subtle)]"
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="flex-1 min-w-56">
          <TextInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(0); }}
            placeholder="Search name, phone, city, address..."
            leftIcon={<Search className="w-4 h-4" />}
            data-testid="data-search"
          />
        </div>
        <div className="w-48">
          <CountrySelect
            value={countryFilter}
            includeAll
            onChange={(v) => { setCountryFilter(v); setPage(0); }}
            data-testid="country-filter"
          />
        </div>
        <div className="w-56">
          <CategorySelect
            value={categoryFilter || 'all'}
            onChange={(v) => { setCategoryFilter(v === 'all' ? '' : v); setPage(0); }}
            options={categories}
            includeAll
            data-testid="category-filter"
          />
        </div>
      </div>

      {/* Downloads */}
      {countryFilter && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span style={{ color: 'var(--text-secondary)' }}>Download {countryFilter}:</span>
          {DOWNLOAD_FORMATS.map((fmt) => (
            <a
              key={fmt}
              href={downloadUrl(countryFilter, fmt)}
              data-testid={`download-${fmt}`}
              style={{
                background: 'var(--bg-surface)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all duration-150 hover:[background:var(--accent-soft)] hover:[color:var(--accent)] hover:[border-color:var(--accent-border)]"
            >
              <Download className="w-3 h-3" />
              {fmt.toUpperCase()}
            </a>
          ))}
        </div>
      )}

      {error && (
        <div
          className="mb-4 px-4 py-3 rounded-md text-sm"
          style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
        >
          {error}
        </div>
      )}

      {retryMsg && (
        <div
          className="mb-4 px-3 py-2 rounded-md text-sm"
          style={{ background: 'var(--info-soft)', color: 'var(--info)' }}
        >
          {retryMsg}
        </div>
      )}

      {viewingFailed ? (
        <FailedRecordsTable
          loading={loading}
          rows={failedRecords}
          onRetryJob={handleRetryJob}
        />
      ) : (
        <Card padded={false}>
          <div className="p-4">
            {loading ? (
              <p className="text-sm py-4" style={{ color: 'var(--text-muted)' }}>Loading...</p>
            ) : filteredRows.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>No records match your filters.</p>
            ) : (
              <>
                <DataTable columns={COLUMNS} rows={paginatedRows} />
                <Pagination pageCount={pageCount} currentPage={page} onPageChange={setPage} />
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function FailedRecordsTable({ loading, rows, onRetryJob }) {
  if (loading) {
    return (
      <Card>
        <p className="text-sm py-4" style={{ color: 'var(--text-muted)' }}>Loading failed records...</p>
      </Card>
    );
  }
  if (!rows || rows.length === 0) {
    return (
      <Card>
        <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>
          No failed records yet. Records that error during scraping will appear here.
        </p>
      </Card>
    );
  }

  // Group by jobId so you can retry each job's failures in one click
  const byJob = new Map();
  for (const r of rows) {
    if (!byJob.has(r.jobId)) byJob.set(r.jobId, []);
    byJob.get(r.jobId).push(r);
  }

  return (
    <Card padded={false} data-testid="failed-records-view">
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)' }}
      >
        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {rows.length} failed record{rows.length === 1 ? '' : 's'} across {byJob.size} job{byJob.size === 1 ? '' : 's'}
        </div>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
        {[...byJob.entries()].map(([jobId, list]) => (
          <div key={jobId} style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <div
              className="px-4 py-2.5 flex items-center justify-between gap-3"
              style={{ background: 'var(--bg-subtle)' }}
            >
              <div className="text-xs flex items-center gap-2 flex-wrap">
                <span
                  className="px-2 py-0.5 rounded-full font-mono"
                  style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                >
                  Job #{jobId}
                </span>
                {list[0].country && <span style={{ color: 'var(--text-muted)' }}>{list[0].country}</span>}
                {list[0].city && list[0].city !== 'all' && <span style={{ color: 'var(--text-muted)' }}>· {list[0].city}</span>}
                {list[0].category && list[0].category !== 'all' && <span style={{ color: 'var(--text-muted)' }}>· {list[0].category}</span>}
                <span style={{ color: 'var(--text-muted)' }}>· {list.length} failure{list.length === 1 ? '' : 's'}</span>
              </div>
              <button
                onClick={() => onRetryJob(jobId)}
                data-testid="failed-retry-btn"
                style={{ color: 'var(--warning)' }}
                className="inline-flex items-center gap-1 text-xs font-medium hover:opacity-80 transition-opacity whitespace-nowrap"
              >
                <RotateCcw className="w-3 h-3" />
                Retry all
              </button>
            </div>
            <ul className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {list.map((entry, i) => (
                <li
                  key={i}
                  className="px-4 py-2.5 flex items-start justify-between gap-3 text-sm"
                  style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none', color: 'var(--text-primary)' }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{entry.name || '(unnamed)'}</div>
                    {entry.error && (
                      <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--danger)' }}>
                        {entry.error}
                      </div>
                    )}
                  </div>
                  {entry.url && (
                    <a
                      href={entry.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs"
                      style={{ color: 'var(--accent)' }}
                      title={entry.url}
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}
