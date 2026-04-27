const API_BASE = '/api';

async function handleJson(res) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// ─── Run controls ────────────────────────────────────────────────────────────

export async function runScraper(body) {
  const res = await fetch(`${API_BASE}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleJson(res);
}

export async function stopScraper() {
  const res = await fetch(`${API_BASE}/run/stop`, { method: 'POST' });
  return handleJson(res);
}

export async function pauseScraper() {
  const res = await fetch(`${API_BASE}/run/pause`, { method: 'POST' });
  return handleJson(res);
}

export async function resumeScraper() {
  const res = await fetch(`${API_BASE}/run/resume`, { method: 'POST' });
  return handleJson(res);
}

export async function getRunStatus(jobId) {
  const url = jobId ? `${API_BASE}/run/status?jobId=${encodeURIComponent(jobId)}` : `${API_BASE}/run/status`;
  return handleJson(await fetch(url));
}

export async function getLogs() {
  return handleJson(await fetch(`${API_BASE}/run/logs`));
}

export async function getProgress() {
  return handleJson(await fetch(`${API_BASE}/run/progress`));
}

// ─── Queue ───────────────────────────────────────────────────────────────────

export async function submitQueue(jobs) {
  const res = await fetch(`${API_BASE}/queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobs }),
  });
  return handleJson(res);
}

export async function getQueueStatus() {
  return handleJson(await fetch(`${API_BASE}/queue/status`));
}

// ─── History ─────────────────────────────────────────────────────────────────

export async function getHistory() {
  return handleJson(await fetch(`${API_BASE}/history`));
}

export async function clearHistory() {
  return handleJson(await fetch(`${API_BASE}/history`, { method: 'DELETE' }));
}

// ─── Settings / Presets ──────────────────────────────────────────────────────

export async function getSettings() {
  return handleJson(await fetch(`${API_BASE}/settings`));
}

export async function updateSettings(settings) {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  return handleJson(res);
}

export async function getPresets() {
  return handleJson(await fetch(`${API_BASE}/presets`));
}

export async function savePreset(name, config) {
  const res = await fetch(`${API_BASE}/presets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, config }),
  });
  return handleJson(res);
}

export async function deletePreset(name) {
  return handleJson(await fetch(`${API_BASE}/presets/${encodeURIComponent(name)}`, { method: 'DELETE' }));
}

// ─── Data / Stats ────────────────────────────────────────────────────────────

export async function getData(options = {}) {
  const params = new URLSearchParams();
  if (options.filter) params.set('filter', options.filter);
  if (options.country) params.set('country', options.country);
  if (options.search) params.set('search', options.search);
  const qs = params.toString();
  return handleJson(await fetch(`${API_BASE}/data${qs ? '?' + qs : ''}`));
}

export async function getStats() {
  return handleJson(await fetch(`${API_BASE}/stats`));
}

export async function getQuality(country) {
  const qs = country ? `?country=${encodeURIComponent(country)}` : '';
  return handleJson(await fetch(`${API_BASE}/quality${qs}`));
}

export async function getCategories(country) {
  const qs = country ? `?country=${encodeURIComponent(country)}` : '';
  return handleJson(await fetch(`${API_BASE}/categories${qs}`));
}

export async function getCities(country) {
  return handleJson(await fetch(`${API_BASE}/cities?country=${encodeURIComponent(country)}`));
}

// ─── Country / city registry (admin-managed) ─────────────────────────────────

export async function getCountries() {
  return handleJson(await fetch(`${API_BASE}/countries`));
}

export async function saveCountry({ code, name, scraper }) {
  const res = await fetch(`${API_BASE}/countries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, name, scraper }),
  });
  return handleJson(res);
}

export async function deleteCountry(code) {
  return handleJson(await fetch(`${API_BASE}/countries/${encodeURIComponent(code)}`, { method: 'DELETE' }));
}

export async function getCitiesFull(country) {
  return handleJson(await fetch(`${API_BASE}/cities/${encodeURIComponent(country)}/full`));
}

export async function saveCities(country, cities) {
  const res = await fetch(`${API_BASE}/cities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ country, cities }),
  });
  return handleJson(res);
}

export async function deleteCity(country, cityName) {
  return handleJson(await fetch(`${API_BASE}/cities/${encodeURIComponent(country)}/${encodeURIComponent(cityName)}`, { method: 'DELETE' }));
}

// ─── Download ────────────────────────────────────────────────────────────────

export function downloadUrl(country, format) {
  return `${API_BASE}/download?country=${encodeURIComponent(country)}&format=${format}`;
}

// ─── Retry failed ────────────────────────────────────────────────────────────

export async function getFailed(jobId) {
  return handleJson(await fetch(`${API_BASE}/failed/${encodeURIComponent(jobId)}`));
}

export async function retryJob(jobId) {
  return handleJson(await fetch(`${API_BASE}/retry/${encodeURIComponent(jobId)}`, { method: 'POST' }));
}

export async function resumeJob(jobId) {
  return handleJson(await fetch(`${API_BASE}/resume/${encodeURIComponent(jobId)}`, { method: 'POST' }));
}

export async function getAllFailed() {
  return handleJson(await fetch(`${API_BASE}/failed`));
}
