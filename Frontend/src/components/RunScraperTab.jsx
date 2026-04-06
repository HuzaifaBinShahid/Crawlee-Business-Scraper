import React, { useState, useEffect } from 'react';
import { Select } from './Select';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { Play, Loader2, CheckCircle, AlertCircle, Info, Square } from 'lucide-react';
import { runScraper, stopScraper, getCategories, getCities } from '../api/client';

const COUNTRY_OPTIONS = [
  { value: 'UK', label: 'UK' },
  { value: 'FR', label: 'France' },
  { value: 'PK', label: 'Pakistan' },
  { value: 'SA', label: 'Saudi Arabia' },
];

const NATIONWIDE_COUNTRIES = ['PK', 'SA'];

const SOURCE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'google', label: 'Google Maps' },
  { value: 'yellow', label: 'Yellow Pages' },
];

const fieldDelay = (i) => ({ animationDelay: `${120 + i * 60}ms`, animationFillMode: 'both' });

export function RunScraperTab({ runState, setRunState }) {
  const [country, setCountry] = useState('UK');
  const [category, setCategory] = useState('all');
  const [source, setSource] = useState('all');
  const [city, setCity] = useState('all');
  const [sample, setSample] = useState(false);
  const [categories, setCategories] = useState([]);
  const [cities, setCities] = useState([]);

  const { jobId, status, error, success } = runState;
  const isRunning = status === 'running';
  const isNationwide = NATIONWIDE_COUNTRIES.includes(country);

  useEffect(() => {
    setCategory('all');
    setCity('all');
    setSource('all');
    getCategories(country).then(setCategories).catch(() => setCategories([]));
    if (isNationwide) {
      getCities(country).then(setCities).catch(() => setCities([]));
    } else {
      setCities([]);
    }
  }, [country]);

  const handleRun = () => {
    setRunState({ jobId: null, status: 'running', error: null, success: null });
    const params = { country, sample };
    if (category !== 'all') params.category = category;
    if (isNationwide) {
      if (city !== 'all') params.city = city;
    } else {
      params.source = source;
    }
    runScraper(params)
      .then(({ jobId: id }) => {
        setRunState((prev) => ({ ...prev, jobId: id }));
      })
      .catch((err) => {
        setRunState({
          jobId: null,
          status: 'idle',
          error: err.message || 'Failed to start scraper',
          success: null,
        });
      });
  };

  const handleStop = () => {
    stopScraper()
      .then(() => {
        setRunState({
          jobId: null,
          status: 'idle',
          success: 'Scraper stopped.',
          error: null,
        });
      })
      .catch((err) => {
        setRunState((prev) => ({
          ...prev,
          jobId: null,
          status: 'idle',
          error: err.message || 'Failed to stop scraper',
        }));
      });
  };

  const categoryOptions = [
    { value: 'all', label: 'All' },
    ...categories.map((c) => ({ value: c, label: c })),
  ];

  const cityOptions = [
    { value: 'all', label: 'All cities' },
    ...cities.map((c) => ({ value: c, label: c })),
  ];

  let fieldIndex = 0;

  return (
    <div className="min-h-[calc(100vh-6rem)] flex flex-col items-center justify-center py-8 animate-fade-in">
      <div className="w-full max-w-lg mx-auto px-4">
        <h1 className="text-2xl font-semibold text-stone-100 text-center mb-8 animate-fade-in-up" style={fieldDelay(fieldIndex++)}>
          Collect Data
        </h1>
        <div
          className="bg-slate-800 rounded-2xl border border-slate-600 shadow-card p-8 animate-fade-in-up hover:shadow-card-hover hover:ring-slate-500/50  transition-all duration-500"
          style={fieldDelay(fieldIndex++)}
        >
          <div className="mb-5 animate-fade-in-up" style={fieldDelay(fieldIndex++)}>
            <Select label="Country" value={country} onChange={setCountry} options={COUNTRY_OPTIONS} />
          </div>
          <div className="mb-5 animate-fade-in-up" style={fieldDelay(fieldIndex++)}>
            <Select label="Category" value={category} onChange={setCategory} options={categoryOptions} placeholder="All" />
          </div>
          {isNationwide && (
            <div className="mb-5 animate-fade-in-up" style={fieldDelay(fieldIndex++)}>
              <Select label="City" value={city} onChange={setCity} options={cityOptions} />
            </div>
          )}
          {!isNationwide && (
            <div className="mb-5 animate-fade-in-up" style={fieldDelay(fieldIndex++)}>
              <Select label="Source" value={source} onChange={setSource} options={SOURCE_OPTIONS} />
            </div>
          )}
          <div className="mb-6 animate-fade-in-up" style={fieldDelay(fieldIndex++)}>
            <Checkbox label="Sample run (small dataset)" checked={sample} onChange={setSample} />
          </div>
          <div className="flex gap-3 animate-fade-in-up" style={fieldDelay(fieldIndex++)}>
            <Button onClick={handleRun} disabled={isRunning} className="flex-1">
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running…
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run scraper
                </>
              )}
            </Button>
            {isRunning && (
              <Button variant="secondary" onClick={handleStop} className="inline-flex items-center gap-2">
                <Square className="w-4 h-4" />
                Stop
              </Button>
            )}
          </div>
          {success && (
            <div className="mt-5 flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-900/50 text-emerald-200 border border-emerald-700 animate-fade-in">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}
          {error && (
            <div className="mt-5 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-900/50 text-red-200 border border-red-700 animate-fade-in">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {isRunning && (
            <div className="mt-5 flex items-center gap-2 px-4 py-3 rounded-xl bg-sky-900/50 text-sky-200 border border-sky-700 animate-fade-in">
              <Info className="w-5 h-5 flex-shrink-0" />
              <span>Scraper is running with browser visible. You can switch tabs—it will keep running. This may take several minutes.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
