import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, CheckCircle, AlertCircle, Globe } from 'lucide-react';
import { Card } from './Card';
import { Button } from './Button';
import { TextInput } from './TextInput';
import { Select } from './Select';
import { Flag } from './Flag';
import {
  saveCountry, deleteCountry,
  getCitiesFull, saveCities, deleteCity,
} from '../api/client';
import { useCountries, refreshCountries } from '../hooks/useCountries';

const SCRAPER_OPTIONS = [
  { value: 'nationwide', label: 'Nationwide (any country)' },
  { value: 'grocery',    label: 'Grocery (UK / FR only)' },
];

export function CountriesAdmin() {
  const { countries } = useCountries();
  const [expanded, setExpanded] = useState(null);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newScraper, setNewScraper] = useState('nationwide');

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(t);
  }, [message]);

  const handleAdd = async () => {
    setError(null);
    const code = newCode.trim().toUpperCase();
    const name = newName.trim();
    if (!/^[A-Z]{2,3}$/.test(code)) { setError('Code must be 2 or 3 letters (e.g. DE, AT, USA).'); return; }
    if (!name) { setError('Name is required.'); return; }
    try {
      await saveCountry({ code, name, scraper: newScraper });
      await refreshCountries();
      setMessage(`Added ${name} (${code}).`);
      setNewCode(''); setNewName(''); setNewScraper('nationwide');
    } catch (err) {
      setError(err.message || 'Failed to add country.');
    }
  };

  const handleDelete = async (c) => {
    if (!confirm(`Remove ${c.name} (${c.code}) from the registry?`)) return;
    setError(null);
    try {
      await deleteCountry(c.code);
      await refreshCountries();
      if (expanded === c.code) setExpanded(null);
      setMessage(`Removed ${c.name}.`);
    } catch (err) {
      setError(err.message || 'Failed to remove country.');
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <Globe className="w-4 h-4" style={{ color: 'var(--accent)' }} />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Countries & Cities
        </h3>
      </div>
      <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
        Add any country in the world. The new country shows up immediately in every dropdown.
        For Nationwide scraping, also add the cities you want to cover.
      </p>

      {/* Existing countries */}
      <div
        className="rounded-md mb-4 overflow-hidden"
        style={{ border: '1px solid var(--border-subtle)' }}
        data-testid="countries-list"
      >
        {countries.length === 0 ? (
          <div className="px-3 py-4 text-sm text-center" style={{ color: 'var(--text-muted)' }}>
            No countries yet. Add one below.
          </div>
        ) : (
          countries.map((c, i) => (
            <CountryRow
              key={c.code}
              country={c}
              first={i === 0}
              expanded={expanded === c.code}
              onToggle={() => setExpanded((cur) => (cur === c.code ? null : c.code))}
              onDelete={() => handleDelete(c)}
              onAfterCitiesChange={() => setMessage(`Cities updated for ${c.name}.`)}
            />
          ))
        )}
      </div>

      {/* Add country form */}
      <div
        className="rounded-md p-3 space-y-3"
        style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          Add country
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <TextInput
            label="Code"
            hint="2–3 letters"
            value={newCode}
            onChange={(v) => setNewCode(v.toUpperCase().slice(0, 3))}
            placeholder="DE"
            data-testid="new-country-code"
          />
          <TextInput
            label="Name"
            value={newName}
            onChange={setNewName}
            placeholder="Germany"
            data-testid="new-country-name"
          />
          <Select
            label="Scraper"
            value={newScraper}
            onChange={setNewScraper}
            options={SCRAPER_OPTIONS}
            placeholder=""
            data-testid="new-country-scraper"
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleAdd} size="sm" data-testid="add-country-btn">
            <Plus className="w-3.5 h-3.5" />
            Add country
          </Button>
        </div>
      </div>

      {message && (
        <div className="mt-3 inline-flex items-center gap-1 text-xs" style={{ color: 'var(--success)' }}>
          <CheckCircle className="w-3.5 h-3.5" />
          {message}
        </div>
      )}
      {error && (
        <div className="mt-3 inline-flex items-center gap-1 text-xs" style={{ color: 'var(--danger)' }}>
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}
    </Card>
  );
}

function CountryRow({ country, first, expanded, onToggle, onDelete, onAfterCitiesChange }) {
  const isNationwide = country.scraper !== 'grocery';
  return (
    <div style={{ borderTop: first ? 'none' : '1px solid var(--border-subtle)' }}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <Flag code={country.code} size={20} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {country.name}
            <span className="ml-2 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{country.code}</span>
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {country.scraper === 'grocery' ? 'GroceryStore scraper' : 'Nationwide scraper'}
          </div>
        </div>
        {isNationwide && (
          <button
            onClick={onToggle}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors"
            style={{ color: 'var(--text-secondary)', background: 'transparent' }}
            data-testid={`manage-cities-${country.code}`}
          >
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Manage cities
          </button>
        )}
        <button
          onClick={onDelete}
          className="p-1.5 rounded-md transition-colors hover:[background:var(--danger-soft)]"
          style={{ color: 'var(--text-muted)' }}
          title={`Remove ${country.name}`}
          data-testid={`delete-country-${country.code}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {expanded && isNationwide && (
        <CitiesEditor country={country} onAfterChange={onAfterCitiesChange} />
      )}
    </div>
  );
}

function CitiesEditor({ country, onAfterChange }) {
  const [cities, setCities] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const list = await getCitiesFull(country.code);
      setCities(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.message || 'Failed to load cities');
      setCities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [country.code]);

  const handleAdd = async () => {
    setError(null);
    const name = newName.trim();
    const code = newCode.trim().toUpperCase();
    if (!name) { setError('City name is required.'); return; }
    if (code && !/^[A-Z]{2,4}$/.test(code)) { setError('City code must be 2–4 letters.'); return; }
    const existing = cities || [];
    const next = [...existing.filter((c) => c.name.toLowerCase() !== name.toLowerCase()), {
      name,
      code: code || name.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'UNK',
    }];
    try {
      await saveCities(country.code, next);
      setCities(next);
      setNewName(''); setNewCode('');
      onAfterChange?.();
    } catch (err) {
      setError(err.message || 'Failed to save city');
    }
  };

  const handleRemove = async (cityName) => {
    if (!confirm(`Remove ${cityName} from ${country.name}?`)) return;
    setError(null);
    try {
      await deleteCity(country.code, cityName);
      setCities((prev) => (prev || []).filter((c) => c.name !== cityName));
      onAfterChange?.();
    } catch (err) {
      setError(err.message || 'Failed to remove city');
    }
  };

  return (
    <div
      className="px-3 pb-3"
      style={{ background: 'var(--bg-subtle)', borderTop: '1px solid var(--border-subtle)' }}
      data-testid={`cities-editor-${country.code}`}
    >
      <div className="pt-3 text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
        Cities for {country.name}
        {cities && (
          <span className="ml-1">· {cities.length}</span>
        )}
      </div>

      {loading ? (
        <div className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>Loading…</div>
      ) : (
        <div
          className="max-h-48 overflow-y-auto rounded-md mb-2"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
        >
          {(cities || []).length === 0 ? (
            <div className="text-xs py-3 px-3 text-center" style={{ color: 'var(--text-muted)' }}>
              No cities yet — add one below.
            </div>
          ) : (
            (cities || []).map((c, i) => (
              <div
                key={c.name + i}
                className="flex items-center gap-2 px-3 py-1.5 text-sm"
                style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              >
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{c.code}</span>
                <button
                  onClick={() => handleRemove(c.name)}
                  className="p-1 rounded transition-colors hover:[background:var(--danger-soft)]"
                  style={{ color: 'var(--text-muted)' }}
                  data-testid={`delete-city-${country.code}-${c.name}`}
                  title={`Remove ${c.name}`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_auto] gap-2 items-end">
        <TextInput
          label="City name"
          value={newName}
          onChange={setNewName}
          placeholder="Berlin"
          data-testid={`new-city-name-${country.code}`}
        />
        <TextInput
          label="Code"
          hint="optional"
          value={newCode}
          onChange={(v) => setNewCode(v.toUpperCase().slice(0, 4))}
          placeholder="BER"
          data-testid={`new-city-code-${country.code}`}
        />
        <Button onClick={handleAdd} size="sm" data-testid={`add-city-btn-${country.code}`}>
          <Plus className="w-3.5 h-3.5" />
          Add
        </Button>
      </div>

      {error && (
        <div className="mt-2 inline-flex items-center gap-1 text-xs" style={{ color: 'var(--danger)' }}>
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}
    </div>
  );
}
