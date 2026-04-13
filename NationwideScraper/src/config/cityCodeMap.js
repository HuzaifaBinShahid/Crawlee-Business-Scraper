/**
 * City name to 3-letter code for external_id: {COUNTRY}-{CITY_CODE}-{PADDED_NUM}
 * Codes are derived from src/config/cities/<country>.json at module load.
 * Example: PK-KHI-000001, SA-RUH-000001
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);

function buildCodeMap(file) {
  try {
    return Object.fromEntries(require(file).map((c) => [c.name.toLowerCase(), c.code]));
  } catch (e) {
    return {};
  }
}

const CITY_CODES = {
  PK: buildCodeMap('./cities/pk.json'),
  SA: buildCodeMap('./cities/sa.json'),
};

/**
 * @param {string} city - City name
 * @param {string} country - Country code (PK, SA, etc.)
 * @returns {string} 3-letter code
 */
export function getCityCode(city, country) {
  if (!city || !country) return 'UNK';
  const cityLower = city.toLowerCase().trim();
  const countryMap = CITY_CODES[country.toUpperCase()];
  if (countryMap && countryMap[cityLower]) return countryMap[cityLower];
  const fallback = city.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
  return fallback || 'UNK';
}

export default CITY_CODES;
