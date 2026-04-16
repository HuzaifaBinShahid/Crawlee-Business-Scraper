import React, { useState, useEffect } from 'react';
import { Select } from './Select';
import { CountrySelect } from './CountrySelect';
import { CategorySelect } from './CategorySelect';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { NumberInput } from './NumberInput';
import { TextArea } from './TextArea';
import { Card } from './Card';
import { SectionHeading } from './SectionHeading';
import { Banner } from './Banner';
import { LogsPanel } from './LogsPanel';
import { QueueStatus } from './QueueStatus';
import { ProgressPanel } from './ProgressPanel';
import {
  Play, Loader2, CheckCircle, AlertCircle, Info, Square, Pause, Save,
  ChevronDown, ChevronUp, AlertTriangle,
  LayoutGrid, MapPin, BookOpen,
} from 'lucide-react';
import {
  runScraper, stopScraper, pauseScraper, resumeScraper,
  getCategories, getCities, submitQueue, getSettings,
  getPresets, savePreset, deletePreset,
} from '../api/client';

const COUNTRY_OPTIONS = [
  { value: 'UK', label: 'UK' },
  { value: 'FR', label: 'France' },
  { value: 'PK', label: 'Pakistan' },
  { value: 'SA', label: 'Saudi Arabia' },
];

const NATIONWIDE_COUNTRIES = ['PK', 'SA'];

const SOURCE_OPTIONS = [
  { value: 'all',    label: 'All sources',   __icon: LayoutGrid },
  { value: 'google', label: 'Google Maps',   __icon: MapPin },
  { value: 'yellow', label: 'Yellow Pages',  __icon: BookOpen },
];

function estimateRun({ categories, cities, sample }) {
  if (sample) return { records: 50, hours: 0.1 };
  const cats = Number(categories) || 8;
  const locs = Number(cities) || 10;
  const avgPerSearch = 40;
  const avgSecPerRecord = 10;
  const records = cats * locs * avgPerSearch;
  const hours = (records * avgSecPerRecord) / 3600;
  return { records, hours };
}

function sliderFillStyle(min, max, value) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return {
    background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, var(--border-strong) ${pct}%, var(--border-strong) 100%)`,
  };
}

export function RunScraperTab({ runState, setRunState }) {
  const [country, setCountry] = useState('UK');
  const [category, setCategory] = useState('all');
  const [source, setSource] = useState('all');
  const [city, setCity] = useState('all');
  const [sample, setSample] = useState(false);
  const [categories, setCategories] = useState([]);
  const [cities, setCities] = useState([]);

  const [minDelay, setMinDelay] = useState(2000);
  const [maxDelay, setMaxDelay] = useState(5000);
  const [proxies, setProxies] = useState('');

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [navTimeout, setNavTimeout] = useState(90);
  const [maxRetries, setMaxRetries] = useState(0);

  const [batchMode, setBatchMode] = useState(false);
  const [selectedCities, setSelectedCities] = useState([]);

  const [presets, setPresets] = useState([]);
  const [presetName, setPresetName] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);

  const [pendingRun, setPendingRun] = useState(null);

  const { status, error, success } = runState;
  const isRunning = status === 'running' || status === 'paused';
  const isPaused = status === 'paused';
  const isNationwide = NATIONWIDE_COUNTRIES.includes(country);

  useEffect(() => {
    getSettings()
      .then((s) => {
        if (s.minDelay) setMinDelay(s.minDelay);
        if (s.maxDelay) setMaxDelay(s.maxDelay);
        if (s.navTimeout) setNavTimeout(s.navTimeout);
        if (s.maxRetries != null) setMaxRetries(s.maxRetries);
        if (s.proxies?.length) setProxies(s.proxies.join('\n'));
      })
      .catch(() => {});
    getPresets().then((p) => setPresets(Array.isArray(p) ? p : [])).catch(() => setPresets([]));
  }, []);

  useEffect(() => {
    setCategory('all');
    setCity('all');
    setSource('all');
    setSelectedCities([]);
    setBatchMode(false);
    getCategories(country).then((c) => setCategories(Array.isArray(c) ? c : [])).catch(() => setCategories([]));
    if (isNationwide) getCities(country).then((c) => setCities(Array.isArray(c) ? c : [])).catch(() => setCities([]));
    else setCities([]);
  }, [country]);

  const buildParams = () => {
    const params = { country, sample, minDelay, maxDelay, navTimeout, maxRetries };
    if (category !== 'all') params.category = category;
    const proxyList = proxies.split('\n').map((s) => s.trim()).filter(Boolean);
    if (proxyList.length) params.proxies = proxyList;
    if (isNationwide) { if (city !== 'all') params.city = city; }
    else params.source = source;
    return params;
  };

  const doRun = () => {
    if (batchMode && isNationwide && selectedCities.length > 0) {
      setRunState({ jobId: null, status: 'running', error: null, success: null });
      const base = buildParams();
      delete base.city;
      const jobs = selectedCities.map((c) => ({ ...base, city: c }));
      submitQueue(jobs)
        .then(({ jobIds }) => setRunState((prev) => ({ ...prev, jobId: jobIds[0] })))
        .catch((err) => setRunState({ jobId: null, status: 'idle', error: err.message || 'Failed to queue', success: null }));
      return;
    }
    setRunState({ jobId: null, status: 'running', error: null, success: null });
    runScraper(buildParams())
      .then(({ jobId: id }) => setRunState((prev) => ({ ...prev, jobId: id })))
      .catch((err) => setRunState({ jobId: null, status: 'idle', error: err.message || 'Failed to start scraper', success: null }));
  };

  const handleRun = () => {
    const runCities = batchMode ? selectedCities.length : (city === 'all' ? 10 : 1);
    const runCategories = category === 'all' ? 8 : 1;
    const est = estimateRun({ categories: runCategories, cities: runCities, sample });
    if (!sample && est.hours > 4) {
      setPendingRun(est);
      return;
    }
    doRun();
  };

  const confirmPendingRun = () => { setPendingRun(null); doRun(); };
  const cancelPendingRun = () => setPendingRun(null);

  const handleStop = () =>
    stopScraper()
      .then(() => setRunState({ jobId: null, status: 'idle', success: 'Scraper stopped.', error: null }))
      .catch((err) => setRunState((prev) => ({ ...prev, jobId: null, status: 'idle', error: err.message || 'Failed to stop scraper' })));
  const handlePause = () => pauseScraper().then(() => setRunState((prev) => ({ ...prev, status: 'paused' }))).catch((err) => setRunState((prev) => ({ ...prev, error: err.message })));
  const handleResume = () => resumeScraper().then(() => setRunState((prev) => ({ ...prev, status: 'running' }))).catch((err) => setRunState((prev) => ({ ...prev, error: err.message })));
  const toggleCity = (c) => setSelectedCities((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);

  const applyPreset = (name) => {
    const p = presets.find((x) => x.name === name);
    if (!p) return;
    const c = p.config;
    if (c.country) setCountry(c.country);
    if (c.category) setCategory(c.category);
    if (c.city) setCity(c.city);
    if (c.minDelay) setMinDelay(c.minDelay);
    if (c.maxDelay) setMaxDelay(c.maxDelay);
    if (c.navTimeout) setNavTimeout(c.navTimeout);
    if (c.maxRetries != null) setMaxRetries(c.maxRetries);
    if (c.proxies) setProxies(Array.isArray(c.proxies) ? c.proxies.join('\n') : c.proxies);
    if (c.sample != null) setSample(c.sample);
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    savePreset(presetName.trim(), buildParams())
      .then(() => {
        setShowSavePreset(false);
        setPresetName('');
        getPresets().then((p) => setPresets(Array.isArray(p) ? p : []));
      })
      .catch(() => {});
  };

  const handleDeletePreset = (name) => {
    if (!confirm(`Delete preset "${name}"?`)) return;
    deletePreset(name).then(() => getPresets().then((p) => setPresets(Array.isArray(p) ? p : [])));
  };

  const categoryOptions = [{ value: 'all', label: 'All' }, ...categories.map((c) => ({ value: c, label: c }))];
  const cityOptions = [{ value: 'all', label: 'All cities' }, ...cities.map((c) => ({ value: c, label: c }))];

  const sidePanelActive = isRunning;

  return (
    <div className="py-8 px-6 md:px-8 animate-fade-in">
      {/* Warning modal */}
      {pendingRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in" style={{ background: 'rgba(0,0,0,0.4)' }} data-testid="warning-modal">
          <div
            className="rounded-[14px] p-6 max-w-md mx-4 animate-scale-in"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--warning)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: 'var(--warning-soft)' }}
              >
                <AlertTriangle className="w-5 h-5" style={{ color: 'var(--warning)' }} />
              </div>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Large Run Warning</h3>
            </div>
            <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
              This run will try to scrape approximately{' '}
              <span className="font-semibold" style={{ color: 'var(--warning)' }}>{pendingRun.records.toLocaleString()}</span> records.
            </p>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Estimated duration:{' '}
              <span className="font-semibold" style={{ color: 'var(--warning)' }}>{pendingRun.hours.toFixed(1)} hours</span>.
            </p>
            <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>
              Consider using proxies or batch mode. Sample mode is great for a quick test.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={cancelPendingRun}>Cancel</Button>
              <Button onClick={confirmPendingRun} data-testid="warning-confirm">Run anyway</Button>
            </div>
          </div>
        </div>
      )}

      <SectionHeading
        eyebrow="Workflow · Collect"
        title="Collect Data"
        subtitle="Configure a scrape run. Queue multiple cities for batch processing."
      />

      <div className={`flex gap-6 transition-all duration-700 ease-out ${sidePanelActive ? 'items-start' : 'justify-center'}`}>
        {/* LEFT: Form */}
        <div className={`w-full transition-all duration-700 ease-out ${sidePanelActive ? 'max-w-md flex-shrink-0' : 'max-w-xl mx-auto'}`}>
          <Card>
            {/* Presets */}
            {presets.length > 0 && (
              <div className="mb-5">
                <Select
                  label="Preset"
                  value=""
                  onChange={(v) => { if (v) applyPreset(v); }}
                  options={[{ value: '', label: '— Choose a preset —' }, ...presets.map((p) => ({ value: p.name, label: p.name }))]}
                  placeholder=""
                  data-testid="preset-select"
                />
                <div className="mt-1 flex flex-wrap gap-1">
                  {presets.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => handleDeletePreset(p.name)}
                      className="text-xs transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                      title={`Delete ${p.name}`}
                    >
                      × {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4">
              <CountrySelect label="Country" value={country} onChange={setCountry} data-testid="run-country-select" />
            </div>
            <div className="mb-4">
              <CategorySelect
                label="Category"
                value={category}
                onChange={setCategory}
                options={categories}
                includeAll
              />
            </div>

            {isNationwide && !batchMode && (
              <div className="mb-4">
                <Select label="City" value={city} onChange={setCity} options={cityOptions} />
              </div>
            )}
            {isNationwide && batchMode && cities.length > 0 && (
              <div className="mb-4">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Select Cities</label>
                <div
                  className="max-h-40 overflow-y-auto rounded-md p-2 space-y-1"
                  style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}
                >
                  {cities.map((c) => (
                    <div key={c} className="px-2 py-1 rounded-sm hover:[background:var(--bg-surface)]">
                      <Checkbox
                        label={c}
                        checked={selectedCities.includes(c)}
                        onChange={() => toggleCity(c)}
                      />
                    </div>
                  ))}
                </div>
                {selectedCities.length > 0 && (
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {selectedCities.length} cities selected
                  </p>
                )}
              </div>
            )}

            {!isNationwide && (
              <div className="mb-4">
                <CategorySelect
                  label="Source"
                  value={source}
                  onChange={setSource}
                  options={SOURCE_OPTIONS}
                  includeAll={false}
                  placeholder="Select source"
                />
              </div>
            )}

            {/* Rate limiting — available for all countries */}
            <div className="mb-4">
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Rate Limiting
                <span className="font-normal ml-1.5" style={{ color: 'var(--text-muted)' }}>· delay between requests</span>
              </label>
              <div
                className="space-y-3 rounded-md p-3"
                style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}
              >
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span style={{ color: 'var(--text-muted)' }}>Min Delay</span>
                    <span style={{ color: 'var(--text-primary)' }}>{(minDelay / 1000).toFixed(1)}s</span>
                  </div>
                  <input
                    type="range"
                    min={500}
                    max={5000}
                    step={100}
                    value={minDelay}
                    onChange={(e) => { const v = Number(e.target.value); setMinDelay(v); if (v > maxDelay) setMaxDelay(v); }}
                    className="range-accent w-full"
                    style={{ '--slider-bg': sliderFillStyle(500, 5000, minDelay).background }}
                    disabled={isRunning}
                    data-testid="min-delay-slider"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span style={{ color: 'var(--text-muted)' }}>Max Delay</span>
                    <span style={{ color: 'var(--text-primary)' }}>{(maxDelay / 1000).toFixed(1)}s</span>
                  </div>
                  <input
                    type="range"
                    min={1000}
                    max={10000}
                    step={100}
                    value={maxDelay}
                    onChange={(e) => { const v = Number(e.target.value); setMaxDelay(v); if (v < minDelay) setMinDelay(v); }}
                    className="range-accent w-full"
                    style={{ '--slider-bg': sliderFillStyle(1000, 10000, maxDelay).background }}
                    disabled={isRunning}
                    data-testid="max-delay-slider"
                  />
                </div>
              </div>
            </div>

            {/* Proxies — available for all countries */}
            <div className="mb-4">
              <TextArea
                label="Proxies"
                hint="one per line, optional"
                value={proxies}
                onChange={setProxies}
                placeholder="http://user:pass@host:port"
                rows={3}
                disabled={isRunning}
                mono
                data-testid="proxies-input"
              />
            </div>

            {/* Advanced — available for all countries */}
            <div className="mb-4">
                <button
                  onClick={() => setShowAdvanced((v) => !v)}
                  style={{ color: 'var(--text-secondary)' }}
                  className="flex items-center gap-1 text-xs font-medium hover:[color:var(--text-primary)] transition-colors"
                  data-testid="toggle-advanced"
                >
                  {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  Advanced settings
                </button>
                {showAdvanced && (
                  <div
                    className="mt-3 space-y-3 rounded-md p-3 animate-fade-in-up"
                    style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}
                    data-testid="advanced-panel"
                  >
                    <NumberInput
                      label="Navigation Timeout"
                      hint="seconds"
                      min={15}
                      max={300}
                      value={navTimeout}
                      onChange={setNavTimeout}
                      data-testid="nav-timeout-input"
                    />
                    <NumberInput
                      label="Max Retries"
                      hint="per request"
                      min={0}
                      max={5}
                      value={maxRetries}
                      onChange={setMaxRetries}
                      data-testid="max-retries-input"
                    />
                  </div>
                )}
            </div>

            <div className="mb-3">
              <Checkbox label="Sample run (small dataset)" checked={sample} onChange={setSample} />
            </div>

            {isNationwide && (
              <div className="mb-5">
                <Checkbox
                  label="Batch mode (queue multiple cities)"
                  checked={batchMode}
                  onChange={(val) => { setBatchMode(val); setSelectedCities([]); }}
                />
              </div>
            )}

            {/* Save preset */}
            {!isRunning && (
              <div className="mb-5">
                {!showSavePreset ? (
                  <button
                    onClick={() => setShowSavePreset(true)}
                    style={{
                      color: 'var(--text-secondary)',
                      background: 'var(--bg-surface)',
                      border: '1px dashed var(--border-strong)',
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all duration-150 ease-out hover:[border-color:var(--accent)] hover:[color:var(--accent)] hover:[background:var(--accent-soft)] active:scale-[0.99]"
                    data-testid="open-save-preset"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save current config as preset
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <input
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      placeholder="Preset name"
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                      }}
                      className="flex-1 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:[border-color:var(--accent)]"
                      data-testid="preset-name-input"
                    />
                    <Button onClick={handleSavePreset} size="sm" data-testid="save-preset-btn">Save</Button>
                    <Button variant="secondary" size="sm" onClick={() => { setShowSavePreset(false); setPresetName(''); }}>Cancel</Button>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                onClick={handleRun}
                disabled={isRunning || (batchMode && selectedCities.length === 0)}
                className="flex-1"
                data-testid="run-btn"
              >
                {status === 'running' ? (<><Loader2 className="w-4 h-4 animate-spin" />Running...</>) : (<><Play className="w-4 h-4" />{batchMode ? 'Queue runs' : 'Run scraper'}</>)}
              </Button>
              {isRunning && !isPaused && (
                <Button variant="secondary" onClick={handlePause} data-testid="pause-btn"><Pause className="w-4 h-4" />Pause</Button>
              )}
              {isPaused && (
                <Button variant="secondary" onClick={handleResume} data-testid="resume-btn"><Play className="w-4 h-4" />Resume</Button>
              )}
              {isRunning && (
                <Button variant="secondary" onClick={handleStop} data-testid="stop-btn"><Square className="w-4 h-4" />Stop</Button>
              )}
            </div>

            {/* Status banners */}
            {success && (
              <Banner icon={CheckCircle} variant="success" title="Run complete">
                {success}
              </Banner>
            )}
            {error && (
              <Banner icon={AlertCircle} variant="danger" title="Something went wrong">
                {error}
              </Banner>
            )}
            {isPaused && (
              <Banner icon={Pause} variant="warning" title="Paused">
                Resume to continue, or Stop to cancel.
              </Banner>
            )}
            {status === 'running' && !isPaused && (
              <Banner icon={Info} variant="info" title="Scraper running">
                You can switch tabs — it will keep running in the background.
              </Banner>
            )}
          </Card>
        </div>

        {/* RIGHT: Activity */}
        {sidePanelActive && (
          <div className="flex-1 min-w-0 animate-slide-in-right">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <span
                className="inline-block w-2 h-2 rounded-full animate-pulse-soft"
                style={{ background: 'var(--success)' }}
              />
              Live Activity
            </h2>
            <ProgressPanel isActive={isRunning} />
            <LogsPanel isActive={isRunning} />
            <QueueStatus />
          </div>
        )}
      </div>
    </div>
  );
}

