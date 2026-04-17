import fs from 'fs';
import os from 'os';
import path from 'path';
import cors from 'cors';
import express from 'express';

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import {
  SCRAPER_DIR, OUTPUT_DIR, SAMPLES_DIR,
  NATIONWIDE_DIR, NATIONWIDE_OUTPUT_DIR, NATIONWIDE_SAMPLES_DIR,
  PORT, CATEGORIES, NATIONWIDE_CATEGORIES, NATIONWIDE_COUNTRIES, NATIONWIDE_CITIES,
} from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const PRESETS_FILE = path.join(DATA_DIR, 'presets.json');
const FAILED_DIR = path.join(DATA_DIR, 'failed');

// Ensure data dirs exist
for (const d of [DATA_DIR, FAILED_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

// Create default files if missing
function ensureJsonFile(filePath, defaultValue) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf-8');
  }
}
ensureJsonFile(HISTORY_FILE, []);

// On startup: any entries still marked "running" must be from a previous process
// that was force-killed. Convert them to "interrupted" so the history stays truthful.
(function reconcileStaleRunning() {
  try {
    const arr = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    if (!Array.isArray(arr)) return;
    let changed = false;
    for (const h of arr) {
      if (h && h.status === 'running') {
        h.status = 'interrupted';
        h.error = h.error || 'Backend was restarted while this job was running.';
        h.endTime = h.endTime || h.startTime;
        changed = true;
      }
    }
    if (changed) fs.writeFileSync(HISTORY_FILE, JSON.stringify(arr, null, 2), 'utf-8');
  } catch (_) { }
})();
ensureJsonFile(SETTINGS_FILE, {
  minDelay: 2000,
  maxDelay: 5000,
  navTimeout: 90,
  maxRetries: 0,
  proxies: [],
});
ensureJsonFile(PRESETS_FILE, []);

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const jobs = new Map();
let nextJobId = 1;
let currentProcess = null;
let currentPauseFile = null;
let jobQueue = [];
let isQueueRunning = false;

// ─── File helpers ────────────────────────────────────────────────────────────

// Support both old format (businesses_PK_full_2026-04-15.json) and new (businesses_PK_client_full.json)
function findLatestJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir);
  const patternOld = /^businesses_([A-Za-z_]+)_(full|sample)_(\d{4}-\d{2}-\d{2})\.json$/;
  const patternNew = /^businesses_([A-Za-z_]+)_client_(full|sample(?:_\d+)?)\.json$/;
  const matched = [];
  for (const f of files) {
    let m = f.match(patternOld);
    if (m) {
      const fullPath = path.join(dir, f);
      matched.push({ fullPath, country: m[1], mode: m[2], mtime: fs.statSync(fullPath).mtimeMs });
      continue;
    }
    m = f.match(patternNew);
    if (m) {
      const fullPath = path.join(dir, f);
      matched.push({ fullPath, country: m[1], mode: m[2].includes('sample') ? 'sample' : 'full', mtime: fs.statSync(fullPath).mtimeMs });
    }
  }
  matched.sort((a, b) => b.mtime - a.mtime);
  const byCountry = {};
  for (const f of matched) if (!byCountry[f.country]) byCountry[f.country] = f;
  return Object.values(byCountry);
}

function getAllJsonFiles() {
  return [
    ...findLatestJsonFiles(OUTPUT_DIR),
    ...findLatestJsonFiles(SAMPLES_DIR),
    ...findLatestJsonFiles(NATIONWIDE_OUTPUT_DIR),
    ...findLatestJsonFiles(NATIONWIDE_SAMPLES_DIR),
  ];
}

function readData() {
  const allFiles = getAllJsonFiles();
  const byCountry = {};
  for (const f of allFiles) {
    const existing = byCountry[f.country];
    if (!existing || f.mtime > existing.mtime) byCountry[f.country] = f;
  }
  const toRead = Object.values(byCountry);
  const data = [];
  let metadata = {};
  for (const { fullPath } of toRead) {
    try {
      const raw = fs.readFileSync(fullPath, 'utf-8');
      const json = JSON.parse(raw);
      const arr = Array.isArray(json) ? json : (Array.isArray(json.data) ? json.data : []);
      data.push(...arr);
      if (json.metadata && Object.keys(metadata).length === 0) metadata = json.metadata;
    } catch (_) { }
  }
  return { data, metadata };
}

/**
 * Compute dashboard stats from the merged record set so they stay consistent with
 * the Data tab (which reads every country's latest file). Handles both schemas:
 * - Nationwide client:  { name, country_code, category_raw, source, businessType? }
 * - GroceryStore:       { businessName, address.country, category, dataSource|source, businessType }
 */
function readStats() {
  const { data } = readData();
  if (!Array.isArray(data) || data.length === 0) return {};

  const byCategory = {};
  const byCountry = {};
  const byType = {};
  const bySources = {};

  const recordType = (r) => {
    const raw = (r.businessType || r.type || '').toString().trim().toLowerCase();
    if (!raw) return '';
    if (raw.startsWith('chain')) return 'Chain';
    if (raw.startsWith('indep')) return 'Independent';
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  };
  const recordSource = (r) => {
    const raw = (r.source || r.dataSource || '').toString().trim();
    if (!raw) return '';
    const low = raw.toLowerCase();
    if (low === 'google_maps' || low.includes('google')) return 'Google Maps';
    if (low.includes('yellow')) return 'Yellow Pages';
    return raw;
  };
  const recordCategory = (r) => (r.category_raw || r.category || '').toString().trim();

  for (const r of data) {
    const cat = recordCategory(r);
    if (cat) byCategory[cat] = (byCategory[cat] || 0) + 1;

    const country = recordCountry(r);
    if (country) byCountry[country] = (byCountry[country] || 0) + 1;

    const type = recordType(r);
    if (type) byType[type] = (byType[type] || 0) + 1;

    const src = recordSource(r);
    if (src) bySources[src] = (bySources[src] || 0) + 1;
  }

  return { byCategory, byCountry, byType, bySources, total: data.length };
}

function findFileByCountry(country, format) {
  // format: 'csv' | 'json' | 'ndjson'
  const dirs = [OUTPUT_DIR, NATIONWIDE_OUTPUT_DIR, SAMPLES_DIR, NATIONWIDE_SAMPLES_DIR];
  let best = null;
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    for (const f of files) {
      if (!f.startsWith(`businesses_${country}_`) && !f.startsWith(`businesses_${country.toUpperCase()}_`)) continue;
      if (!f.endsWith(`.${format}`)) continue;
      const fullPath = path.join(dir, f);
      const mtime = fs.statSync(fullPath).mtimeMs;
      if (!best || mtime > best.mtime) best = { fullPath, mtime, name: f };
    }
  }
  return best;
}

function isNationwideCountry(country) {
  return NATIONWIDE_COUNTRIES.includes((country || '').toUpperCase());
}

/**
 * Resolve a record's country code regardless of schema:
 * - NationwideScraper client records use `country_code`
 * - GroceryStore-script records use `address.country`
 * - Some legacy shapes use top-level `country`
 */
function recordCountry(r) {
  if (!r) return '';
  const raw = r.country_code
    || r.country
    || (r.address && typeof r.address === 'object' ? r.address.country : '')
    || '';
  return String(raw).toUpperCase().trim();
}

/** Pull searchable text out of a record regardless of schema (flat client vs nested legacy). */
function recordSearchHaystack(r) {
  if (!r) return '';
  const parts = [
    r.name, r.businessName,
    r.phone, r.contact && r.contact.phone,
    r.city, r.address && typeof r.address === 'object' ? r.address.city : '',
    typeof r.address === 'string' ? r.address : '',
    r.address && typeof r.address === 'object' ? [r.address.street, r.address.city, r.address.zipCode, r.address.state].filter(Boolean).join(', ') : '',
    r.website, r.contact && r.contact.website,
    r.category_raw, r.category,
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function cleanupPauseFile() {
  if (currentPauseFile) {
    try { fs.unlinkSync(currentPauseFile); } catch (_) { }
    currentPauseFile = null;
  }
}

// ─── History ─────────────────────────────────────────────────────────────────

function readHistory() {
  try { return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8')); } catch (_) { return []; }
}

/**
 * Upsert a history entry by jobId. Keeps existing fields and merges in new ones,
 * so recording on start + update on finish doesn't create duplicate rows.
 */
function appendHistory(entry) {
  const history = readHistory();
  if (entry && entry.jobId != null) {
    const existingIdx = history.findIndex((h) => String(h.jobId) === String(entry.jobId));
    if (existingIdx >= 0) {
      history[existingIdx] = { ...history[existingIdx], ...entry };
    } else {
      history.unshift(entry);
    }
  } else {
    history.unshift(entry);
  }
  if (history.length > 200) history.length = 200;
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
  } catch (err) {
    console.error('[history] write failed:', err.message);
  }
}

// ─── Settings / Presets ──────────────────────────────────────────────────────

function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')); } catch (_) {
    return { minDelay: 2000, maxDelay: 5000, navTimeout: 90, maxRetries: 0, proxies: [] };
  }
}

function writeSettings(s) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2), 'utf-8');
}

function readPresets() {
  try { return JSON.parse(fs.readFileSync(PRESETS_FILE, 'utf-8')); } catch (_) { return []; }
}

function writePresets(p) {
  fs.writeFileSync(PRESETS_FILE, JSON.stringify(p, null, 2), 'utf-8');
}

// ─── Progress event parser ───────────────────────────────────────────────────

function parseProgressLine(line, job) {
  if (!line.startsWith('[PROGRESS] ')) return false;
  try {
    const payload = JSON.parse(line.slice('[PROGRESS] '.length));
    if (!job.counters) job.counters = { found: 0, saved: 0, skipped: 0, duplicates: 0, failed: 0 };
    if (!job.currentTask) job.currentTask = null;
    switch (payload.event) {
      case 'task_start':
        job.currentTask = { country: payload.country, city: payload.city, category: payload.category, keyword: payload.keyword };
        break;
      case 'task_end':
        job.currentTask = null;
        break;
      case 'record_saved':
        job.counters.saved++;
        job.counters.found++;
        break;
      case 'record_skipped':
        job.counters.skipped++;
        break;
      case 'record_duplicate':
        job.counters.duplicates++;
        break;
      case 'record_failed':
        job.counters.failed++;
        // Persist failed URL for retry
        if (payload.url && job.jobId) {
          const failedFile = path.join(FAILED_DIR, `${job.jobId}.json`);
          let failedList = [];
          try { failedList = JSON.parse(fs.readFileSync(failedFile, 'utf-8')); } catch (_) { }
          failedList.push({ name: payload.name, url: payload.url, error: payload.error, at: Date.now() });
          try { fs.writeFileSync(failedFile, JSON.stringify(failedList, null, 2), 'utf-8'); } catch (_) { }
        }
        break;
    }
    return true;
  } catch (_) {
    return false;
  }
}

// ─── Spawn helper ────────────────────────────────────────────────────────────

function startJob(config) {
  const { country, category, source = 'all', sample = false, city, minDelay, maxDelay, proxies, navTimeout, maxRetries, retryFile, concurrency } = config;
  const jobId = config.jobId || String(nextJobId++);
  const nationwide = isNationwideCountry(country);

  let scriptPath, cwd, args;

  if (nationwide) {
    cwd = NATIONWIDE_DIR;
    scriptPath = path.join(NATIONWIDE_DIR, 'src', 'main.js');
    args = ['src/main.js', '--country=' + country, '--no-headless'];
    if (category && category !== 'all' && NATIONWIDE_CATEGORIES.includes(category)) args.push('--category=' + category);
    if (city && city !== 'all') args.push('--city=' + city);
    if (sample) args.push('--sample');
    if (minDelay != null) args.push('--min-delay=' + Math.max(500, Number(minDelay) || 2000));
    if (maxDelay != null) args.push('--max-delay=' + Math.max(1000, Number(maxDelay) || 5000));
    if (proxies && proxies.length) args.push('--proxy=' + proxies.join(','));
    if (navTimeout != null) args.push('--nav-timeout=' + Math.max(15, Number(navTimeout) || 90));
    if (maxRetries != null) args.push('--max-retries=' + Math.max(0, Number(maxRetries) || 0));
    if (retryFile) args.push('--retry-file=' + retryFile);
  } else {
    cwd = SCRAPER_DIR;
    scriptPath = path.join(SCRAPER_DIR, 'src', 'main.js');
    args = ['src/main.js', '--country=' + country];
    if (category && category !== 'all' && CATEGORIES.includes(category)) args.push('--category=' + category);
    if (source && ['google', 'yellow', 'all'].includes(source)) args.push('--source=' + source);
    if (sample) args.push('--sample');
    // Concurrency is only safe for UK/FR (GroceryStore handles multi-tab fine).
    // Nationwide (PK/SA) forces concurrency=1 inside its scraper due to Playwright
    // elementHandle issues on Google Maps — exposing a slider there would be misleading.
    if (concurrency != null) {
      const n = Math.max(1, Math.min(6, Number(concurrency) || 2));
      args.push('--concurrency=' + n);
    }
    // Pass rate-limit / proxy flags (GroceryStore yargs ignores unknown args silently;
    // once it supports these flags they'll start taking effect).
    if (minDelay != null) args.push('--min-delay=' + Math.max(500, Number(minDelay) || 2000));
    if (maxDelay != null) args.push('--max-delay=' + Math.max(1000, Number(maxDelay) || 5000));
    if (proxies && proxies.length) args.push('--proxy=' + proxies.join(','));
    if (navTimeout != null) args.push('--nav-timeout=' + Math.max(15, Number(navTimeout) || 90));
    if (maxRetries != null) args.push('--max-retries=' + Math.max(0, Number(maxRetries) || 0));
  }

  const pauseFile = path.join(os.tmpdir(), `scraper_pause_${jobId}.flag`);
  currentPauseFile = pauseFile;
  const env = { ...process.env, HEADLESS: 'false', PAUSE_FILE: pauseFile };

  if (!fs.existsSync(scriptPath)) {
    const job = { jobId, status: 'failed', error: `Script not found: ${scriptPath}`, startTime: Date.now(), endTime: Date.now(), stderr: [], stdout: [], counters: { found: 0, saved: 0, skipped: 0, duplicates: 0, failed: 0 }, config };
    jobs.set(jobId, job);
    appendHistory({ jobId, ...config, status: 'failed', error: job.error, startTime: job.startTime, endTime: job.endTime, counters: job.counters });
    return { jobId, error: job.error };
  }

  console.log('[scraper] Spawning:', { cwd, scriptPath, args });
  const child = spawn('node', [scriptPath, ...args.slice(1)], { env, cwd });

  const job = {
    jobId,
    status: 'running',
    startTime: Date.now(),
    stderr: [],
    stdout: [],
    config,
    counters: { found: 0, saved: 0, skipped: 0, duplicates: 0, failed: 0 },
    currentTask: null,
  };
  jobs.set(jobId, job);
  currentProcess = { jobId, child };

  // Persist a start entry immediately so a force-killed backend still leaves a trace
  appendHistory({
    jobId, ...config, status: 'running',
    startTime: job.startTime, endTime: null,
    counters: job.counters,
  });

  child.stderr?.on('data', (chunk) => {
    const text = String(chunk);
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (parseProgressLine(trimmed, job)) continue;
      job.stderr.push(trimmed);
      if (job.stderr.length > 200) job.stderr.shift();
    }
  });

  child.stdout?.on('data', (chunk) => {
    const text = String(chunk);
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (parseProgressLine(trimmed, job)) continue;
      job.stdout.push(trimmed);
      if (job.stdout.length > 200) job.stdout.shift();
    }
  });

  child.on('close', (code, signal) => {
    if (job) {
      job.status = code === 0 ? 'completed' : 'failed';
      job.endTime = Date.now();
      job.code = code;
      job.signal = signal || null;
      if (code !== 0) {
        const tail = job.stderr.slice(-15).join('\n');
        job.error = signal ? `Process killed (signal ${signal}).` : tail || `Process exited with code ${code}.`;
      }
    }
    appendHistory({
      jobId, ...config, status: job.status, error: job.error,
      startTime: job.startTime, endTime: job.endTime,
      counters: job.counters, currentTask: null,
    });
    cleanupPauseFile();
    currentProcess = null;
    processNextInQueue();
  });

  child.on('error', (err) => {
    if (job) { job.status = 'failed'; job.error = err.message; job.endTime = Date.now(); }
    appendHistory({ jobId, ...config, status: 'failed', error: err.message, startTime: job.startTime, endTime: job.endTime, counters: job.counters });
    cleanupPauseFile();
    currentProcess = null;
    processNextInQueue();
  });

  return { jobId };
}

function processNextInQueue() {
  if (currentProcess) return;
  if (jobQueue.length === 0) { isQueueRunning = false; return; }
  const next = jobQueue.shift();
  startJob(next);
}

// ─── API Routes ──────────────────────────────────────────────────────────────

app.post('/api/run', (req, res) => {
  if (currentProcess) return res.status(409).json({ error: 'A run is already in progress' });
  const { country } = req.body || {};
  if (!country) return res.status(400).json({ error: 'country is required' });
  const nationwide = isNationwideCountry(country);
  if (!nationwide && !['UK', 'FR'].includes(country)) {
    return res.status(400).json({ error: 'country must be UK, FR, PK, or SA' });
  }
  const result = startJob(req.body);
  if (result.error) return res.status(500).json({ error: result.error });
  res.json({ jobId: result.jobId });
});

app.post('/api/run/stop', (req, res) => {
  if (!currentProcess) return res.status(409).json({ error: 'No run in progress' });
  const job = jobs.get(currentProcess.jobId);
  if (job) { job.status = 'failed'; job.error = 'Stopped by user'; job.endTime = Date.now(); }
  currentProcess.child.kill('SIGTERM');
  cleanupPauseFile();
  currentProcess = null;
  jobQueue = [];
  isQueueRunning = false;
  res.json({ stopped: true });
});

app.post('/api/run/pause', (req, res) => {
  if (!currentProcess || !currentPauseFile) return res.status(409).json({ error: 'No run in progress' });
  fs.writeFileSync(currentPauseFile, '1');
  const job = jobs.get(currentProcess.jobId);
  if (job) job.status = 'paused';
  res.json({ paused: true });
});

app.post('/api/run/resume', (req, res) => {
  if (!currentProcess || !currentPauseFile) return res.status(409).json({ error: 'No run in progress' });
  try { fs.unlinkSync(currentPauseFile); } catch (_) { }
  const job = jobs.get(currentProcess.jobId);
  if (job) job.status = 'running';
  res.json({ resumed: true });
});

app.get('/api/run/status', (req, res) => {
  const { jobId } = req.query;
  if (jobId) {
    const job = jobs.get(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    return res.json({ status: job.status, error: job.error, jobId });
  }
  if (currentProcess) {
    const job = jobs.get(currentProcess.jobId);
    return res.json({ status: job?.status || 'running', jobId: currentProcess.jobId });
  }
  const lastJobId = Array.from(jobs.keys()).pop();
  const lastJob = lastJobId ? jobs.get(lastJobId) : null;
  res.json({ status: lastJob?.status || 'idle', jobId: lastJobId, error: lastJob?.error });
});

app.get('/api/run/logs', (req, res) => {
  const target = currentProcess ? jobs.get(currentProcess.jobId) : (jobs.size ? jobs.get(Array.from(jobs.keys()).pop()) : null);
  res.json({
    stdout: target?.stdout || [],
    stderr: target?.stderr || [],
    status: target?.status || 'idle',
  });
});

app.get('/api/run/progress', (req, res) => {
  const target = currentProcess ? jobs.get(currentProcess.jobId) : (jobs.size ? jobs.get(Array.from(jobs.keys()).pop()) : null);
  res.json({
    counters: target?.counters || { found: 0, saved: 0, skipped: 0, duplicates: 0, failed: 0 },
    currentTask: target?.currentTask || null,
    status: target?.status || 'idle',
    jobId: target?.jobId || null,
  });
});

// ─── Queue ────────────────────────────────────────────────────────────────────

app.post('/api/queue', (req, res) => {
  const { jobs: jobConfigs } = req.body || {};
  if (!Array.isArray(jobConfigs) || jobConfigs.length === 0) {
    return res.status(400).json({ error: 'jobs array is required' });
  }
  const valid = jobConfigs.filter((c) => c.country);
  if (!valid.length) return res.status(400).json({ error: 'Each job needs a country' });

  const addedIds = [];
  for (const config of valid) {
    const jobId = String(nextJobId++);
    jobs.set(jobId, { jobId, status: 'queued', config, startTime: null, stdout: [], stderr: [], counters: { found: 0, saved: 0, skipped: 0, duplicates: 0, failed: 0 } });
    jobQueue.push({ ...config, jobId });
    addedIds.push(jobId);
  }
  isQueueRunning = true;
  processNextInQueue();
  res.json({ queued: addedIds.length, jobIds: addedIds });
});

app.get('/api/queue/status', (req, res) => {
  const pending = jobQueue.map((c) => ({ jobId: c.jobId, country: c.country, category: c.category || 'all', city: c.city || 'all' }));
  const currentJobId = currentProcess?.jobId || null;
  const currentJob = currentJobId ? jobs.get(currentJobId) : null;
  res.json({
    isRunning: !!currentProcess,
    isQueueRunning,
    currentJobId,
    currentConfig: currentJob?.config || null,
    pendingCount: pending.length,
    pending,
  });
});

// ─── History ─────────────────────────────────────────────────────────────────

app.get('/api/history', (req, res) => {
  res.json(readHistory());
});

app.delete('/api/history', (req, res) => {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2), 'utf-8');
  res.json({ cleared: true });
});

// ─── Settings ────────────────────────────────────────────────────────────────

app.get('/api/settings', (req, res) => res.json(readSettings()));

app.put('/api/settings', (req, res) => {
  const current = readSettings();
  const updated = { ...current, ...req.body };
  writeSettings(updated);
  res.json(updated);
});

// ─── Presets ─────────────────────────────────────────────────────────────────

app.get('/api/presets', (req, res) => res.json(readPresets()));

app.post('/api/presets', (req, res) => {
  const { name, config } = req.body || {};
  if (!name || !config) return res.status(400).json({ error: 'name and config required' });
  const presets = readPresets();
  const existing = presets.findIndex((p) => p.name === name);
  const entry = { name, config, updatedAt: Date.now() };
  if (existing >= 0) presets[existing] = entry; else presets.push(entry);
  writePresets(presets);
  res.json(entry);
});

app.delete('/api/presets/:name', (req, res) => {
  const presets = readPresets().filter((p) => p.name !== req.params.name);
  writePresets(presets);
  res.json({ deleted: true });
});

// ─── Download / Data Quality ─────────────────────────────────────────────────

app.get('/api/download', (req, res) => {
  const { country, format = 'csv' } = req.query;
  if (!country) return res.status(400).json({ error: 'country is required' });
  if (!['csv', 'json', 'ndjson'].includes(format)) return res.status(400).json({ error: 'invalid format' });
  const file = findFileByCountry(country, format);
  if (!file) return res.status(404).json({ error: 'No file found for this country/format' });
  res.download(file.fullPath, file.name);
});

app.get('/api/quality', (req, res) => {
  try {
    const country = req.query.country;
    const { data } = readData();
    const records = country
      ? data.filter((r) => recordCountry(r) === String(country).toUpperCase())
      : data;
    const total = records.length;
    if (total === 0) return res.json({ total: 0, completeness: 0, missing: {}, duplicates: 0, incomplete: 0 });

    // Abstract field getters so both nationwide (flat) and GroceryStore (nested) records contribute equally
    const fieldAccessors = {
      name:    (r) => r.name || r.businessName,
      phone:   (r) => r.phone || r.contact?.phone,
      website: (r) => r.website || r.contact?.website,
      address: (r) => typeof r.address === 'string' ? r.address : (r.address?.street || r.address?.city),
      lat:     (r) => r.lat ?? r.latitude,
      lon:     (r) => r.lon ?? r.longitude,
      category:(r) => r.category_raw || r.category,
    };
    const fieldKeys = Object.keys(fieldAccessors);
    const missing = Object.fromEntries(fieldKeys.map((k) => [k, 0]));
    let incompleteCount = 0;
    const dedupeKeys = new Set();
    let duplicates = 0;

    for (const r of records) {
      let filledCount = 0;
      for (const f of fieldKeys) {
        const v = fieldAccessors[f](r);
        if (v == null || v === '' || v === 0) missing[f]++;
        else filledCount++;
      }
      if (filledCount < fieldKeys.length * 0.6) incompleteCount++;

      const name = (r.name || r.businessName || '').toLowerCase();
      const lat = r.lat ?? r.latitude ?? '';
      const lon = r.lon ?? r.longitude ?? '';
      const key = `${name}|${lat}|${lon}`;
      if (dedupeKeys.has(key)) duplicates++; else dedupeKeys.add(key);
    }

    const totalFilled = fieldKeys.length * total - Object.values(missing).reduce((a, b) => a + b, 0);
    const completeness = Math.round((totalFilled / (fieldKeys.length * total)) * 100);
    res.json({ total, completeness, missing, duplicates, incomplete: incompleteCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Retry failed records ────────────────────────────────────────────────────

app.get('/api/failed/:jobId', (req, res) => {
  const file = path.join(FAILED_DIR, `${req.params.jobId}.json`);
  if (!fs.existsSync(file)) return res.json([]);
  try { res.json(JSON.parse(fs.readFileSync(file, 'utf-8'))); } catch (_) { res.json([]); }
});

/**
 * Aggregate every failed record across every job, joined to its source job
 * for the Data tab's "Failed" filter view.
 */
app.get('/api/failed', (req, res) => {
  try {
    if (!fs.existsSync(FAILED_DIR)) return res.json([]);
    const files = fs.readdirSync(FAILED_DIR).filter((f) => f.endsWith('.json'));
    const history = readHistory();
    const historyByJob = new Map(history.map((h) => [String(h.jobId), h]));
    const all = [];
    for (const f of files) {
      const jobId = f.replace(/\.json$/, '');
      let list = [];
      try { list = JSON.parse(fs.readFileSync(path.join(FAILED_DIR, f), 'utf-8')); } catch (_) { }
      if (!Array.isArray(list)) continue;
      const h = historyByJob.get(String(jobId)) || {};
      for (const entry of list) {
        all.push({
          jobId,
          country: h.country || null,
          city: h.city || null,
          category: h.category || null,
          name: entry.name || '',
          url: entry.url || '',
          error: entry.error || '',
          at: entry.at || null,
        });
      }
    }
    all.sort((a, b) => (b.at || 0) - (a.at || 0));
    res.json(all);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Resume an interrupted / failed run by re-dispatching its original config.
 * Scraper-side dedupe ensures already-saved records are skipped.
 */
app.post('/api/resume/:jobId', (req, res) => {
  if (currentProcess) return res.status(409).json({ error: 'A run is already in progress' });
  const origJobId = req.params.jobId;
  const history = readHistory();
  const original = history.find((h) => String(h.jobId) === String(origJobId));
  if (!original) return res.status(404).json({ error: 'Original job config not found' });
  // Strip runtime-only fields so startJob treats this as a fresh run with the same target
  const { status, error, startTime, endTime, counters, currentTask, code, signal, ...config } = original;
  // Let startJob mint a new jobId rather than collide with the original
  delete config.jobId;
  const result = startJob(config);
  if (result.error) return res.status(500).json({ error: result.error });
  res.json({ jobId: result.jobId, resumed: true, fromJobId: origJobId });
});

app.post('/api/retry/:jobId', (req, res) => {
  if (currentProcess) return res.status(409).json({ error: 'A run is already in progress' });
  const origJobId = req.params.jobId;
  const failedFile = path.join(FAILED_DIR, `${origJobId}.json`);
  if (!fs.existsSync(failedFile)) return res.status(404).json({ error: 'No failed records for this job' });
  // Find the original config from history
  const history = readHistory();
  const original = history.find((h) => String(h.jobId) === String(origJobId));
  if (!original) return res.status(404).json({ error: 'Original job config not found' });
  const result = startJob({ ...original, retryFile: failedFile });
  if (result.error) return res.status(500).json({ error: result.error });
  res.json({ jobId: result.jobId, retrying: true });
});

// ─── Data / Stats / Config ───────────────────────────────────────────────────

app.get('/api/data', (req, res) => {
  try {
    const { filter, country, search } = req.query;
    let { data, metadata } = readData();

    if (country) {
      const wanted = String(country).toUpperCase();
      data = data.filter((r) => recordCountry(r) === wanted);
    }

    if (filter === 'duplicates') {
      const seen = new Map();
      const dups = [];
      for (const r of data) {
        const name = (r.name || r.businessName || '').toLowerCase();
        const lat = r.lat ?? r.latitude ?? '';
        const lon = r.lon ?? r.longitude ?? '';
        const key = `${name}|${lat}|${lon}`;
        if (seen.has(key)) dups.push(r);
        else seen.set(key, true);
      }
      data = dups;
    } else if (filter === 'incomplete') {
      // Works across schemas — checks both flat and nested shapes
      data = data.filter((r) => {
        const has = (v) => v != null && v !== '' && v !== 0;
        const flags = [
          has(r.name || r.businessName),
          has(r.phone || r.contact?.phone),
          has(r.website || r.contact?.website),
          has(typeof r.address === 'string' ? r.address : r.address?.street || r.address?.city),
          has(r.lat ?? r.latitude),
          has(r.lon ?? r.longitude),
        ];
        const filled = flags.filter(Boolean).length;
        return filled < flags.length * 0.6;
      });
    }

    if (search) {
      const q = String(search).toLowerCase();
      data = data.filter((r) => recordSearchHaystack(r).includes(q));
    }

    res.json({ data, metadata });
  } catch (err) {
    res.status(500).json({ error: err.message, data: [], metadata: {} });
  }
});

app.get('/api/stats', (req, res) => {
  try { res.json(readStats()); }
  catch (err) { res.status(500).json({}); }
});

app.get('/api/categories', (req, res) => {
  const country = (req.query.country || '').toUpperCase();
  if (isNationwideCountry(country)) return res.json(NATIONWIDE_CATEGORIES);
  res.json(CATEGORIES);
});

app.get('/api/cities', (req, res) => {
  const country = (req.query.country || '').toUpperCase();
  res.json(NATIONWIDE_CITIES[country] || []);
});

// ─── Health check for tests ──────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: Date.now() });
});

// Export app for testing
export { app, startJob, recordCountry, recordSearchHaystack };

// Start listening unless in test mode
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Scraper API listening on http://localhost:${PORT}`);
  });
}
