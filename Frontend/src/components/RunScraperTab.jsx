import React, { useState, useEffect } from 'react';
import { Select } from './Select';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { LogsPanel } from './LogsPanel';
import { QueueStatus } from './QueueStatus';
import { Play, Loader2, CheckCircle, AlertCircle, Info, Square, Pause } from 'lucide-react';
import { runScraper, stopScraper, pauseScraper, resumeScraper, getCategories, getCities, submitQueue } from '../api/client';

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

  // Speed control
  const [minDelay, setMinDelay] = useState(2000);
  const [maxDelay, setMaxDelay] = useState(5000);

  // Proxy
  const [proxies, setProxies] = useState('');

  // Batch mode
  const [batchMode, setBatchMode] = useState(false);
  const [selectedCities, setSelectedCities] = useState([]);

  const { jobId, status, error, success } = runState;
  const isRunning = status === 'running' || status === 'paused';
  const isPaused = status === 'paused';
  const isNationwide = NATIONWIDE_COUNTRIES.includes(country);

  useEffect(() => {
    setCategory('all');
    setCity('all');
    setSource('all');
    setSelectedCities([]);
    setBatchMode(false);
    getCategories(country).then(setCategories).catch(() => setCategories([]));
    if (isNationwide) {
      getCities(country).then(setCities).catch(() => setCities([]));
    } else {
      setCities([]);
    }
  }, [country]);

  const handleRun = () => {
    if (batchMode && isNationwide && selectedCities.length > 0) {
      // Batch mode — queue multiple jobs
      setRunState({ jobId: null, status: 'running', error: null, success: null });
      const jobs = selectedCities.map((c) => ({
        country,
        category: category !== 'all' ? category : undefined,
        city: c,
        sample,
        minDelay,
        maxDelay,
        proxies: proxies.split('\n').map((s) => s.trim()).filter(Boolean),
      }));
      submitQueue(jobs)
        .then(({ jobIds }) => {
          setRunState((prev) => ({ ...prev, jobId: jobIds[0] }));
        })
        .catch((err) => {
          setRunState({ jobId: null, status: 'idle', error: err.message || 'Failed to queue jobs', success: null });
        });
      return;
    }

    // Single run
    setRunState({ jobId: null, status: 'running', error: null, success: null });
    const params = { country, sample, minDelay, maxDelay };
    if (category !== 'all') params.category = category;
    const proxyList = proxies.split('\n').map((s) => s.trim()).filter(Boolean);
    if (proxyList.length) params.proxies = proxyList;
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
        setRunState({ jobId: null, status: 'idle', error: err.message || 'Failed to start scraper', success: null });
      });
  };

  const handleStop = () => {
    stopScraper()
      .then(() => {
        setRunState({ jobId: null, status: 'idle', success: 'Scraper stopped.', error: null });
      })
      .catch((err) => {
        setRunState((prev) => ({ ...prev, jobId: null, status: 'idle', error: err.message || 'Failed to stop scraper' }));
      });
  };

  const handlePause = () => {
    pauseScraper()
      .then(() => {
        setRunState((prev) => ({ ...prev, status: 'paused' }));
      })
      .catch((err) => {
        setRunState((prev) => ({ ...prev, error: err.message || 'Failed to pause' }));
      });
  };

  const handleResume = () => {
    resumeScraper()
      .then(() => {
        setRunState((prev) => ({ ...prev, status: 'running' }));
      })
      .catch((err) => {
        setRunState((prev) => ({ ...prev, error: err.message || 'Failed to resume' }));
      });
  };

  const toggleCity = (c) => {
    setSelectedCities((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
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
  const sidePanelActive = isRunning;

  return (
    <div className="min-h-[calc(100vh-6rem)] flex flex-col items-center justify-center py-8 animate-fade-in">
      <div
        className={`w-full flex gap-6 px-4 transition-all duration-700 ease-out ${
          sidePanelActive ? 'max-w-6xl items-start' : 'max-w-lg flex-col items-center'
        }`}
      >
        {/* LEFT: Form box */}
        <div className={`w-full transition-all duration-700 ease-out ${sidePanelActive ? 'max-w-md flex-shrink-0' : 'max-w-lg mx-auto'}`}>
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

          {/* City — single select or batch multi-select */}
          {isNationwide && !batchMode && (
            <div className="mb-5 animate-fade-in-up" style={fieldDelay(fieldIndex++)}>
              <Select label="City" value={city} onChange={setCity} options={cityOptions} />
            </div>
          )}
          {isNationwide && batchMode && cities.length > 0 && (
            <div className="mb-5 animate-fade-in-up" style={fieldDelay(fieldIndex++)}>
              <label className="block text-sm font-medium text-slate-300 mb-2">Select Cities</label>
              <div className="max-h-40 overflow-y-auto bg-slate-900 rounded-lg border border-slate-600 p-2 space-y-1">
                {cities.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm text-slate-300 hover:bg-slate-800 rounded px-2 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCities.includes(c)}
                      onChange={() => toggleCity(c)}
                      className="rounded border-slate-500 bg-slate-700 text-cyan-500 focus:ring-cyan-500"
                    />
                    {c}
                  </label>
                ))}
              </div>
              {selectedCities.length > 0 && (
                <p className="text-xs text-slate-500 mt-1">{selectedCities.length} cities selected</p>
              )}
            </div>
          )}

          {!isNationwide && (
            <div className="mb-5 animate-fade-in-up" style={fieldDelay(fieldIndex++)}>
              <Select label="Source" value={source} onChange={setSource} options={SOURCE_OPTIONS} />
            </div>
          )}

          {/* Rate limiting sliders */}
          {isNationwide && (
            <div className="mb-5 animate-fade-in-up" style={fieldDelay(fieldIndex++)}>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Rate Limiting <span className="text-slate-500 font-normal text-xs">(delay between requests)</span>
              </label>
              <div className="space-y-3 bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Min Delay</span>
                    <span>{(minDelay / 1000).toFixed(1)}s</span>
                  </div>
                  <input
                    type="range"
                    min={500}
                    max={5000}
                    step={100}
                    value={minDelay}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setMinDelay(val);
                      if (val > maxDelay) setMaxDelay(val);
                    }}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    disabled={isRunning}
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Max Delay</span>
                    <span>{(maxDelay / 1000).toFixed(1)}s</span>
                  </div>
                  <input
                    type="range"
                    min={1000}
                    max={10000}
                    step={100}
                    value={maxDelay}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setMaxDelay(val);
                      if (val < minDelay) setMinDelay(val);
                    }}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    disabled={isRunning}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Proxy textarea */}
          {isNationwide && (
            <div className="mb-5 animate-fade-in-up" style={fieldDelay(fieldIndex++)}>
              <label className="block text-sm font-medium text-slate-300 mb-1">Proxies <span className="text-slate-500 font-normal">(one per line, optional)</span></label>
              <textarea
                rows={3}
                value={proxies}
                onChange={(e) => setProxies(e.target.value)}
                placeholder="http://user:pass@host:port"
                disabled={isRunning}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 resize-none font-mono"
              />
            </div>
          )}

          <div className="mb-4 animate-fade-in-up" style={fieldDelay(fieldIndex++)}>
            <Checkbox label="Sample run (small dataset)" checked={sample} onChange={setSample} />
          </div>

          {/* Batch mode checkbox — only for nationwide */}
          {isNationwide && (
            <div className="mb-6 animate-fade-in-up" style={fieldDelay(fieldIndex++)}>
              <Checkbox
                label="Batch mode (queue multiple cities)"
                checked={batchMode}
                onChange={(val) => { setBatchMode(val); setSelectedCities([]); }}
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 animate-fade-in-up" style={fieldDelay(fieldIndex++)}>
            <Button
              onClick={handleRun}
              disabled={isRunning || (batchMode && selectedCities.length === 0)}
              className="flex-1"
            >
              {status === 'running' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  {batchMode ? 'Queue runs' : 'Run scraper'}
                </>
              )}
            </Button>
            {isRunning && !isPaused && (
              <Button variant="secondary" onClick={handlePause} className="inline-flex items-center gap-2">
                <Pause className="w-4 h-4" />
                Pause
              </Button>
            )}
            {isPaused && (
              <Button variant="secondary" onClick={handleResume} className="inline-flex items-center gap-2">
                <Play className="w-4 h-4" />
                Resume
              </Button>
            )}
            {isRunning && (
              <Button variant="secondary" onClick={handleStop} className="inline-flex items-center gap-2">
                <Square className="w-4 h-4" />
                Stop
              </Button>
            )}
          </div>

          {/* Status messages */}
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
          {isPaused && (
            <div className="mt-5 flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-900/50 text-amber-200 border border-amber-700 animate-fade-in">
              <Pause className="w-5 h-5 flex-shrink-0" />
              <span>Scraper is paused. Click Resume to continue or Stop to cancel.</span>
            </div>
          )}
          {status === 'running' && !isPaused && (
            <div className="mt-5 flex items-center gap-2 px-4 py-3 rounded-xl bg-sky-900/50 text-sky-200 border border-sky-700 animate-fade-in">
              <Info className="w-5 h-5 flex-shrink-0" />
              <span>Scraper is running. You can switch tabs—it will keep running.</span>
            </div>
          )}
        </div>
        </div>
        {/* END LEFT */}

        {/* RIGHT: Logs + Queue panel — slides in when running */}
        {sidePanelActive && (
          <div className="flex-1 min-w-0 animate-slide-in-right">
            <h2 className="text-lg font-semibold text-stone-100 mb-4 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Activity
            </h2>
            <LogsPanel isActive={isRunning} />
            <QueueStatus />
          </div>
        )}
      </div>
    </div>
  );
}
