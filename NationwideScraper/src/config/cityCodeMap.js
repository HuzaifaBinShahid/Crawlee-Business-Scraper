/**
 * City name to 3-letter code for external_id: {COUNTRY}-{CITY_CODE}-{PADDED_NUM}
 * Codes are read lazily from src/config/cities/<country>.json so any newly added
 * country JSON file works automatically — no edit here required.
 * Example: PK-KHI-000001, SA-RUH-000001
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CITIES_DIR = path.join(__dirname, 'cities');

const cache = {};

function loadMap(country) {
  const cc = String(country).toUpperCase();
  if (cache[cc]) return cache[cc];
  const fp = path.join(CITIES_DIR, `${cc.toLowerCase()}.json`);
  if (!fs.existsSync(fp)) {
    cache[cc] = {};
    return cache[cc];
  }
  try {
    const arr = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    cache[cc] = Object.fromEntries(
      arr
        .filter((c) => c && c.name && c.code)
        .map((c) => [c.name.toLowerCase(), c.code]),
    );
    return cache[cc];
  } catch (_) {
    cache[cc] = {};
    return cache[cc];
  }
}

/**
 * @param {string} city - City name
 * @param {string} country - Country code (PK, SA, DE, etc.)
 * @returns {string} 3-letter code
 */
export function getCityCode(city, country) {
  if (!city || !country) return 'UNK';
  const cityLower = city.toLowerCase().trim();
  const countryMap = loadMap(country);
  if (countryMap[cityLower]) return countryMap[cityLower];
  const fallback = city.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
  return fallback || 'UNK';
}

export default { getCityCode };
