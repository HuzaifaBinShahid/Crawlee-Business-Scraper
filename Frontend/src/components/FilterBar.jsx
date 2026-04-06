import React from 'react';
import { Select } from './Select';
import { Button } from './Button';
import { RefreshCw } from 'lucide-react';

export function FilterBar({ countryFilter, onCountryFilterChange, categoryFilter, onCategoryFilterChange, categoryOptions = [], onRefresh, loading }) {
  const countryOptions = [
    { value: '', label: 'All' },
    { value: 'UK', label: 'UK' },
    { value: 'FR', label: 'France' },
    { value: 'PK', label: 'Pakistan' },
    { value: 'SA', label: 'Saudi Arabia' },
  ];

  const catOptions = [
    { value: '', label: 'All' },
    ...categoryOptions.map((c) => (typeof c === 'object' ? c : { value: c, label: c })),
  ];

  return (
    <div className="flex flex-wrap items-end gap-4 mb-6">
      <Select
        label="Country"
        value={countryFilter}
        onChange={onCountryFilterChange}
        options={countryOptions}
        placeholder={null}
      />
      <Select
        label="Category"
        value={categoryFilter}
        onChange={onCategoryFilterChange}
        options={catOptions}
        placeholder={null}
      />
      <div className="mb-4">
        <Button variant="secondary" onClick={onRefresh} disabled={loading} className="inline-flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>
    </div>
  );
}
