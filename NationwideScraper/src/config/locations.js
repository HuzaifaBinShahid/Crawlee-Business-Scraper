/**
 * Locations per country, loaded from JSON files at startup.
 * Edit src/config/cities/<country>.json to add/remove cities.
 * Sample mode uses first city only (e.g. Karachi, Riyadh).
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const JSON_CITY_FILES = {
  PK: './cities/pk.json',
  SA: './cities/sa.json',
};

const cache = {};

function loadCities(key) {
  if (cache[key]) return cache[key];
  const fp = JSON_CITY_FILES[key];
  if (!fp) return null;
  try {
    cache[key] = require(fp);
    return cache[key];
  } catch (e) {
    return null;
  }
}

/**
 * @param {string} country - Country code (PK, SA) or generic name
 * @param {boolean} sampleOnly - If true, return only first city for sample (50 records)
 * @returns {string[]}
 */
export function getLocations(country, sampleOnly = false) {
  const key = country && typeof country === 'string' ? country.toUpperCase() : '';
  const data = loadCities(key);
  if (!data) {
    // Generic country: use country name as single location
    return country ? [country.trim()] : [];
  }
  const names = data.map((c) => c.name);
  if (sampleOnly) return names.length ? [names[0]] : [];
  return names;
}

export default { getLocations };
