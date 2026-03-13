import React, { useState, useEffect, useMemo } from 'react';
import { getData, getCategories } from '../api/client';
import { DataTable } from './DataTable';
import { FilterBar } from './FilterBar';
import { Pagination } from './Pagination';

const PAGE_SIZE = 25;

const COLUMNS = [
  { key: 'uniqueId', label: 'ID' },
  { key: 'businessName', label: 'Name' },
  { key: 'businessType', label: 'Type' },
  { key: 'category', label: 'Category' },
  {
    key: 'address',
    label: 'Address',
    render: (_, row) => {
      const a = row.address || {};
      const parts = [a.street, a.city, a.zipCode, a.state].filter(Boolean);
      return parts.length ? parts.join(', ') : '—';
    },
  },
  { key: 'country', label: 'Country', render: (_, row) => (row.address && row.address.country) || '—' },
  { key: 'phone', label: 'Phone', render: (_, row) => (row.contact && row.contact.phone) || '—' },
  {
    key: 'website',
    label: 'Website',
    render: (_, row) => {
      const url = row.contact && row.contact.website;
      if (!url) return '—';
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors"
        >
          {url.length > 40 ? url.slice(0, 40) + '…' : url}
        </a>
      );
    },
  },
];

export function DataTab() {
  const [data, setData] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [countryFilter, setCountryFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(0);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    Promise.all([getData(), getCategories()])
      .then(([dataRes, catRes]) => {
        setData(Array.isArray(dataRes.data) ? dataRes.data : []);
        setCategories(Array.isArray(catRes) ? catRes : []);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load data');
        setData([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredRows = useMemo(() => {
    let list = data;
    if (countryFilter) {
      list = list.filter((row) => (row.address && row.address.country) === countryFilter);
    }
    if (categoryFilter) {
      list = list.filter((row) => row.category === categoryFilter);
    }
    return list;
  }, [data, countryFilter, categoryFilter]);

  const pageCount = Math.ceil(filteredRows.length / PAGE_SIZE) || 1;
  const paginatedRows = useMemo(() => {
    const start = page * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  useEffect(() => {
    if (page >= pageCount && page > 0) setPage(pageCount - 1);
  }, [pageCount, page]);

  const countryFromAddress = (row) => (row.address && row.address.country) || '';
  const rowsWithCountry = useMemo(
    () => paginatedRows.map((r) => ({ ...r, country: countryFromAddress(r) })),
    [paginatedRows],
  );

  return (
    <div className="animate-fade-in-up">
      <h1 className="text-xl font-semibold text-stone-100 mb-6">Data</h1>
      <FilterBar
        countryFilter={countryFilter}
        onCountryFilterChange={(v) => {
          setCountryFilter(v);
          setPage(0);
        }}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={(v) => {
          setCategoryFilter(v);
          setPage(0);
        }}
        categoryOptions={categories}
        onRefresh={fetchData}
        loading={loading}
      />
      {error && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-lg bg-red-900/50 text-red-200 border border-red-700">
          {error}
        </div>
      )}
      <div className="bg-slate-800 rounded-xl border border-slate-600 shadow-card p-6 hover:shadow-card-hover transition-shadow duration-300">
        {loading ? (
          <p className="text-slate-400 text-sm py-4">Loading…</p>
        ) : (
          <>
            <DataTable columns={COLUMNS} rows={rowsWithCountry} />
            <Pagination pageCount={pageCount} currentPage={page} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
