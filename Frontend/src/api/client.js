const API_BASE = '/api';

export async function runScraper(body) {
  const res = await fetch(`${API_BASE}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export async function getRunStatus(jobId) {
  const url = jobId ? `${API_BASE}/run/status?jobId=${encodeURIComponent(jobId)}` : `${API_BASE}/run/status`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

export async function stopScraper() {
  const res = await fetch(`${API_BASE}/run/stop`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export async function getData() {
  const res = await fetch(`${API_BASE}/data`);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

export async function getStats() {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

export async function getCategories(country) {
  const qs = country ? `?country=${encodeURIComponent(country)}` : '';
  const res = await fetch(`${API_BASE}/categories${qs}`);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

export async function getCities(country) {
  const res = await fetch(`${API_BASE}/cities?country=${encodeURIComponent(country)}`);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}
