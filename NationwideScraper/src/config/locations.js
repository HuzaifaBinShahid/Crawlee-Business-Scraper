/**
 * Locations per country, loaded from JSON files in src/config/cities/<cc>.json.
 * Drop a new file (e.g. cities/de.json) and it works automatically — no edit
 * to this file required.
 *
 * Sample mode uses the first city only (one city quick-look).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CITIES_DIR = path.join(__dirname, 'cities');

const cache = {};

function loadCities(key) {
  if (!key) return null;
  if (cache[key]) return cache[key];
  const fp = path.join(CITIES_DIR, `${key.toLowerCase()}.json`);
  if (!fs.existsSync(fp)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    cache[key] = Array.isArray(data) ? data : null;
    return cache[key];
  } catch (e) {
    return null;
  }
}

/**
 * @param {string} country - Country code (PK, SA, DE, etc.) or generic name
 * @param {boolean} sampleOnly - If true, return only first city for sample (10 records)
 * @returns {string[]} City names for the country, or [] if no cities are configured.
 *   When this returns [], main.js falls back to a single country-wide search using
 *   the full country display name (e.g. "South Africa") rather than the raw code.
 */
export function getLocations(country, sampleOnly = false) {
  const key = country && typeof country === 'string' ? country.toUpperCase() : '';
  const data = loadCities(key);
  if (!data) return [];
  const names = data
    .map((c) => (typeof c === 'string' ? c : c?.name))
    .filter(Boolean);
  if (sampleOnly) return names.length ? [names[0]] : [];
  return names;
}

export default { getLocations };
