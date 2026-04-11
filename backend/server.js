import fs from 'fs';
import os from 'os';
import path from 'path';
import cors from 'cors';
import express from 'express';

import { spawn } from 'child_process';
import {
  SCRAPER_DIR, OUTPUT_DIR, SAMPLES_DIR,
  NATIONWIDE_DIR, NATIONWIDE_OUTPUT_DIR, NATIONWIDE_SAMPLES_DIR,
  PORT, CATEGORIES, NATIONWIDE_CATEGORIES, NATIONWIDE_COUNTRIES, NATIONWIDE_CITIES,
} from './config.js';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const jobs = new Map();
let nextJobId = 1;
let currentProcess = null;
let currentPauseFile = null;

// Job queue for batch processing
let jobQueue = [];
let isQueueRunning = false;

function findLatestJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir);
  const pattern = /^businesses_([A-Za-z_]+)_(full|sample)_(\d{4}-\d{2}-\d{2})\.json$/;
  const matched = files
    .filter((f) => pattern.test(f))
    .map((f) => {
      const fullPath = path.join(dir, f);
      const stat = fs.statSync(fullPath);
      const [, country, mode, dateStr] = f.match(pattern);
      return { fullPath, country, mode, dateStr, mtime: stat.mtimeMs };
    });
  matched.sort((a, b) => b.mtime - a.mtime);
  const byCountry = {};
  for (const f of matched) {
    if (!byCountry[f.country]) byCountry[f.country] = f;
  }
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
      if (Array.isArray(json.data)) data.push(...json.data);
      if (json.metadata && Object.keys(metadata).length === 0) metadata = json.metadata;
    } catch (_) { }
  }
  return { data, metadata };
}

function readStats() {
  const allFiles = getAllJsonFiles();
  if (allFiles.length === 0) return {};
  const latest = allFiles.sort((a, b) => b.mtime - a.mtime)[0];
  try {
    const raw = fs.readFileSync(latest.fullPath, 'utf-8');
    const json = JSON.parse(raw);
    return json.metadata?.statistics || {};
  } catch (_) {
    return {};
  }
}

function isNationwideCountry(country) {
  return NATIONWIDE_COUNTRIES.includes((country || '').toUpperCase());
}

function cleanupPauseFile() {
  if (currentPauseFile) {
    try { fs.unlinkSync(currentPauseFile); } catch (_) { }
    currentPauseFile = null;
  }
}

/** Core function to start a scraper job. Used by both /api/run and queue processing. */
function startJob(config) {
  const { country, category, source = 'all', sample = false, city, minDelay, maxDelay, proxies } = config;
  const jobId = config.jobId || String(nextJobId++);
  const nationwide = isNationwideCountry(country);

  let scriptPath, cwd, args;

  if (nationwide) {
    cwd = NATIONWIDE_DIR;
    scriptPath = path.join(NATIONWIDE_DIR, 'src', 'main.js');
    args = ['src/main.js', '--country=' + country, '--no-headless'];
    if (category && category !== 'all' && NATIONWIDE_CATEGORIES.includes(category)) {
      args.push('--category=' + category);
    }
    if (city && city !== 'all') {
      args.push('--city=' + city);
    }
    if (sample) args.push('--sample');
    if (minDelay != null) args.push('--min-delay=' + Math.max(500, Number(minDelay) || 2000));
    if (maxDelay != null) args.push('--max-delay=' + Math.max(1000, Number(maxDelay) || 5000));
    if (proxies && proxies.length) {
      args.push('--proxy=' + proxies.join(','));
    }
  } else {
    cwd = SCRAPER_DIR;
    scriptPath = path.join(SCRAPER_DIR, 'src', 'main.js');
    args = ['src/main.js', '--country=' + country];
    if (category && category !== 'all' && CATEGORIES.includes(category)) {
      args.push('--category=' + category);
    }
    if (source && ['google', 'yellow', 'all'].includes(source)) {
      args.push('--source=' + source);
    }
    if (sample) args.push('--sample');
  }

  // Generate pause file for this job
  const pauseFile = path.join(os.tmpdir(), `scraper_pause_${jobId}.flag`);
  currentPauseFile = pauseFile;
  const env = { ...process.env, HEADLESS: 'false', PAUSE_FILE: pauseFile };

  if (!fs.existsSync(scriptPath)) {
    const job = { status: 'failed', error: `Script not found: ${scriptPath}`, startTime: Date.now(), endTime: Date.now(), stderr: [], stdout: [] };
    jobs.set(jobId, job);
    return { jobId, error: job.error };
  }

  console.log('[scraper] Spawning:', { cwd, scriptPath, args });
  const child = spawn('node', [scriptPath, ...args.slice(1)], { env, cwd });

  const job = { status: 'running', startTime: Date.now(), stderr: [], stdout: [], config };
  jobs.set(jobId, job);
  currentProcess = { jobId, child };

  child.stderr?.on('data', (chunk) => {
    const line = String(chunk).trim();
    if (line) job.stderr.push(line);
    if (job.stderr.length > 200) job.stderr.shift();
  });

  child.stdout?.on('data', (chunk) => {
    const line = String(chunk).trim();
    if (line) job.stdout.push(line);
    if (job.stdout.length > 200) job.stdout.shift();
  });

  child.on('close', (code, signal) => {
    if (job) {
      job.status = code === 0 ? 'completed' : 'failed';
      job.endTime = Date.now();
      job.code = code;
      job.signal = signal || null;
      if (code !== 0) {
        const tail = job.stderr.slice(-15).join('\n');
        job.error = signal
          ? `Process killed (signal ${signal}).`
          : tail || `Process exited with code ${code}.`;
      }
    }
    cleanupPauseFile();
    currentProcess = null;
    // Process next job in queue if any
    processNextInQueue();
  });

  child.on('error', (err) => {
    if (job) {
      job.status = 'failed';
      job.error = err.message;
      job.endTime = Date.now();
    }
    cleanupPauseFile();
    currentProcess = null;
    processNextInQueue();
  });

  return { jobId };
}

function processNextInQueue() {
  if (currentProcess) return;
  if (jobQueue.length === 0) {
    isQueueRunning = false;
    return;
  }
  const next = jobQueue.shift();
  startJob(next);
}

// ─── API Routes ──────────────────────────────────────────────────────────────

app.post('/api/run', (req, res) => {
  if (currentProcess) {
    return res.status(409).json({ error: 'A run is already in progress' });
  }
  const { country, category, source, sample, city, minDelay, maxDelay, proxies } = req.body || {};
  if (!country) {
    return res.status(400).json({ error: 'country is required' });
  }
  const nationwide = isNationwideCountry(country);
  if (!nationwide && !['UK', 'FR'].includes(country)) {
    return res.status(400).json({ error: 'country must be UK, FR, PK, or SA' });
  }

  const result = startJob({ country, category, source, sample, city, minDelay, maxDelay, proxies });
  if (result.error) {
    return res.status(500).json({ error: result.error });
  }
  res.json({ jobId: result.jobId });
});

app.post('/api/run/stop', (req, res) => {
  if (!currentProcess) {
    return res.status(409).json({ error: 'No run in progress' });
  }
  const job = jobs.get(currentProcess.jobId);
  if (job) {
    job.status = 'failed';
    job.error = 'Stopped by user';
    job.endTime = Date.now();
  }
  currentProcess.child.kill('SIGTERM');
  cleanupPauseFile();
  currentProcess = null;
  // Clear remaining queue when stopping
  jobQueue = [];
  isQueueRunning = false;
  res.json({ stopped: true });
});

app.post('/api/run/pause', (req, res) => {
  if (!currentProcess || !currentPauseFile) {
    return res.status(409).json({ error: 'No run in progress' });
  }
  fs.writeFileSync(currentPauseFile, '1');
  const job = jobs.get(currentProcess.jobId);
  if (job) job.status = 'paused';
  res.json({ paused: true });
});

app.post('/api/run/resume', (req, res) => {
  if (!currentProcess || !currentPauseFile) {
    return res.status(409).json({ error: 'No run in progress' });
  }
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
    return res.json({
      status: job.status,
      error: job.error,
      lastOutputPath: job.lastOutputPath,
    });
  }
  if (currentProcess) {
    const job = jobs.get(currentProcess.jobId);
    return res.json({
      status: job?.status || 'running',
      jobId: currentProcess.jobId,
    });
  }
  const lastJobId = Array.from(jobs.keys()).pop();
  const lastJob = lastJobId ? jobs.get(lastJobId) : null;
  res.json({
    status: lastJob?.status || 'idle',
    jobId: lastJobId,
    error: lastJob?.error,
  });
});

app.get('/api/run/logs', (req, res) => {
  if (currentProcess) {
    const job = jobs.get(currentProcess.jobId);
    return res.json({
      stdout: job?.stdout || [],
      stderr: job?.stderr || [],
      status: job?.status || 'running',
    });
  }
  const lastJobId = Array.from(jobs.keys()).pop();
  const lastJob = lastJobId ? jobs.get(lastJobId) : null;
  res.json({
    stdout: lastJob?.stdout || [],
    stderr: lastJob?.stderr || [],
    status: lastJob?.status || 'idle',
  });
});

// ─── Queue / Batch ───────────────────────────────────────────────────────────

app.post('/api/queue', (req, res) => {
  const { jobs: jobConfigs } = req.body || {};
  if (!Array.isArray(jobConfigs) || jobConfigs.length === 0) {
    return res.status(400).json({ error: 'jobs array is required' });
  }
  const valid = jobConfigs.filter((c) => c.country);
  if (!valid.length) {
    return res.status(400).json({ error: 'Each job needs a country' });
  }

  const addedIds = [];
  for (const config of valid) {
    const jobId = String(nextJobId++);
    jobs.set(jobId, { status: 'queued', config, startTime: null, stdout: [], stderr: [] });
    jobQueue.push({ ...config, jobId });
    addedIds.push(jobId);
  }
  isQueueRunning = true;
  processNextInQueue();
  res.json({ queued: addedIds.length, jobIds: addedIds });
});

app.get('/api/queue/status', (req, res) => {
  const pending = jobQueue.map((c) => ({
    jobId: c.jobId,
    country: c.country,
    category: c.category || 'all',
    city: c.city || 'all',
  }));
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

// ─── Data / Stats / Config ───────────────────────────────────────────────────

app.get('/api/data', (_req, res) => {
  try {
    const { data, metadata } = readData();
    res.json({ data, metadata });
  } catch (err) {
    res.status(500).json({ error: err.message, data: [], metadata: {} });
  }
});

app.get('/api/stats', (_req, res) => {
  try {
    const statistics = readStats();
    res.json(statistics);
  } catch (err) {
    res.status(500).json({});
  }
});

app.get('/api/categories', (req, res) => {
  const country = (req.query.country || '').toUpperCase();
  if (isNationwideCountry(country)) {
    return res.json(NATIONWIDE_CATEGORIES);
  }
  res.json(CATEGORIES);
});

app.get('/api/cities', (req, res) => {
  const country = (req.query.country || '').toUpperCase();
  res.json(NATIONWIDE_CITIES[country] || []);
});

app.listen(PORT, () => {
  console.log(`Scraper API listening on http://localhost:${PORT}`);
});
