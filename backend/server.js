import fs from 'fs';
import path from 'path';
import cors from 'cors';
import express from 'express';

import { spawn } from 'child_process';
import { SCRAPER_DIR, OUTPUT_DIR, SAMPLES_DIR, PORT, CATEGORIES } from './config.js';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const jobs = new Map();
let nextJobId = 1;
let currentProcess = null;

function findLatestJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir);
  const pattern = /^businesses_(UK|FR)_(full|sample)_(\d{4}-\d{2}-\d{2})\.json$/;
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

function readData() {
  const fromOutput = findLatestJsonFiles(OUTPUT_DIR);
  const fromSamples = findLatestJsonFiles(SAMPLES_DIR);
  const allFiles = [...fromOutput, ...fromSamples];
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
  const fromOutput = findLatestJsonFiles(OUTPUT_DIR);
  const fromSamples = findLatestJsonFiles(SAMPLES_DIR);
  const allFiles = [...fromOutput, ...fromSamples];
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

app.post('/api/run', (req, res) => {
  if (currentProcess) {
    return res.status(409).json({ error: 'A run is already in progress' });
  }
  const { country, category, source = 'all', sample = false } = req.body || {};
  if (!country || !['UK', 'FR'].includes(country)) {
    return res.status(400).json({ error: 'country must be UK or FR' });
  }
  const jobId = String(nextJobId++);
  const args = ['src/main.js', '--country=' + country];
  if (category && category !== 'all' && CATEGORIES.includes(category)) {
    args.push('--category=' + category);
  }
  if (source && ['google', 'yellow', 'all'].includes(source)) {
    args.push('--source=' + source);
  }
  if (sample) args.push('--sample');

  const scriptPath = path.join(SCRAPER_DIR, 'src', 'main.js');
  const env = { ...process.env, HEADLESS: 'false' };
  const cwd = SCRAPER_DIR;

  if (!fs.existsSync(scriptPath)) {
    return res.status(500).json({
      error: `Scraper script not found at ${scriptPath}. Check SCRAPER_DIR (${SCRAPER_DIR}).`,
    });
  }

  console.log('[scraper] Spawning:', { cwd, scriptPath, args });
  const child = spawn('node', [scriptPath, ...args.slice(1)], { env, cwd });

  const job = { status: 'running', startTime: Date.now(), stderr: [], stdout: [] };
  jobs.set(jobId, job);
  currentProcess = { jobId, child };

  child.stderr?.on('data', (chunk) => {
    const line = String(chunk).trim();
    if (line) job.stderr.push(line);
    if (job.stderr.length > 50) job.stderr.shift();
  });

  child.stdout?.on('data', (chunk) => {
    const line = String(chunk).trim();
    if (line) job.stdout.push(line);
    if (job.stdout.length > 50) job.stdout.shift();
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
    currentProcess = null;
  });

  child.on('error', (err) => {
    if (job) {
      job.status = 'failed';
      job.error = err.message;
      job.endTime = Date.now();
    }
    currentProcess = null;
  });

  res.json({ jobId });
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
  currentProcess = null;
  res.json({ stopped: true });
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

app.get('/api/categories', (_req, res) => {
  res.json(CATEGORIES);
});

app.listen(PORT, () => {
  console.log(`Scraper API listening on http://localhost:${PORT}`);
});
