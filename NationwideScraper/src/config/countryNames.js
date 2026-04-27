/**
 * Country code / alias to display name for Google Maps search queries.
 * Query format: "keyword in location, CountryName"
 *
 * Two sources, in priority order:
 *   1. The dynamic registry at backend/data/countries.json — admin-managed at runtime
 *   2. The hardcoded CODE_TO_NAME / ALIASES_TO_CODE below — legacy fallback so the
 *      scraper still works without the backend present (e.g. CLI smoke tests)
 *
 * This lets admin-added countries (e.g. RSA → "South Africa") resolve correctly
 * in Google Maps search queries without code changes.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REGISTRY_PATH = path.join(__dirname, '..', '..', '..', 'backend', 'data', 'countries.json');

let registryCache = null;
let registryMtime = 0;

function loadRegistry() {
  try {
    const stat = fs.statSync(REGISTRY_PATH);
    if (registryCache && stat.mtimeMs === registryMtime) return registryCache;
    const arr = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
    registryCache = Array.isArray(arr) ? arr : [];
    registryMtime = stat.mtimeMs;
    return registryCache;
  } catch (_) {
    return registryCache || [];
  }
}

function registryLookupByCode(code) {
  const upper = String(code || '').toUpperCase().trim();
  if (!upper) return null;
  return loadRegistry().find((c) => String(c.code || '').toUpperCase() === upper) || null;
}

function registryLookupByName(name) {
  const lower = String(name || '').toLowerCase().trim();
  if (!lower) return null;
  return loadRegistry().find((c) => String(c.name || '').toLowerCase() === lower) || null;
}

const CODE_TO_NAME = {
  PK: 'Pakistan',
  SA: 'Saudi Arabia',
  PAK: 'Pakistan',
  SAU: 'Saudi Arabia',
  KSA: 'Saudi Arabia',
  UK: 'United Kingdom',
  GB: 'United Kingdom',
  FR: 'France',
  DE: 'Germany',
  ES: 'Spain',
  IT: 'Italy',
  NL: 'Netherlands',
  BE: 'Belgium',
  PT: 'Portugal',
  AT: 'Austria',
  CH: 'Switzerland',
  IE: 'Ireland',
  PL: 'Poland',
  SE: 'Sweden',
  NO: 'Norway',
  DK: 'Denmark',
  FI: 'Finland',
  GR: 'Greece',
  IN: 'India',
  TR: 'Turkey',
  AE: 'United Arab Emirates',
  EG: 'Egypt',
};

const ALIASES_TO_CODE = {
  pakistan: 'PK', pak: 'PK', pk: 'PK',
  saudi: 'SA', 'saudi arabia': 'SA', ksa: 'SA', sa: 'SA',
  uk: 'UK', 'united kingdom': 'UK', britain: 'UK', 'great britain': 'UK', england: 'UK', gb: 'UK',
  france: 'FR', fr: 'FR',
  germany: 'DE', de: 'DE', deutschland: 'DE',
  spain: 'ES', es: 'ES',
  italy: 'IT', it: 'IT',
  netherlands: 'NL', nl: 'NL',
  belgium: 'BE', be: 'BE',
  portugal: 'PT', pt: 'PT',
  austria: 'AT', at: 'AT',
  switzerland: 'CH', ch: 'CH',
  ireland: 'IE', ie: 'IE',
  poland: 'PL', pl: 'PL',
  sweden: 'SE', se: 'SE',
  norway: 'NO', no: 'NO',
  denmark: 'DK', dk: 'DK',
  finland: 'FI', fi: 'FI',
  greece: 'GR', gr: 'GR',
  india: 'IN', in: 'IN',
  turkey: 'TR', tr: 'TR',
  'united arab emirates': 'AE', uae: 'AE', ae: 'AE',
  egypt: 'EG', eg: 'EG',
};

/**
 * Get display name for search query. If code is known, return full country name; else return as-is.
 * @param {string} country - User input (e.g. PK, SA, Pakistan, India)
 * @returns {string} Display name for "keyword in city, DisplayName"
 */
export function getCountryDisplayName(country) {
  if (!country || typeof country !== 'string') return '';
  const trimmed = country.trim();
  const upper = trimmed.toUpperCase();
  const lower = trimmed.toLowerCase();

  // Dynamic registry first — admin-added countries take priority
  const byCode = registryLookupByCode(upper);
  if (byCode?.name) return byCode.name;
  const byName = registryLookupByName(trimmed);
  if (byName?.name) return byName.name;

  if (CODE_TO_NAME[upper]) return CODE_TO_NAME[upper];
  if (ALIASES_TO_CODE[lower]) return CODE_TO_NAME[ALIASES_TO_CODE[lower]] || trimmed;
  return trimmed;
}

/**
 * Normalize user input to a 2-letter country code for config lookup (PK, SA) or null for generic.
 * @param {string} country - User input
 * @returns {string} PK, SA, or original string (e.g. India) for generic
 */
export function normalizeCountryCode(country) {
  if (!country || typeof country !== 'string') return '';
  const trimmed = country.trim();
  const lower = trimmed.toLowerCase();
  const upper = trimmed.toUpperCase();

  // Dynamic registry first — admin-added codes/names take priority
  const byCode = registryLookupByCode(upper);
  if (byCode?.code) return byCode.code;
  const byName = registryLookupByName(trimmed);
  if (byName?.code) return byName.code;

  if (ALIASES_TO_CODE[lower]) return ALIASES_TO_CODE[lower].toUpperCase();
  if (lower === 'pk' || lower === 'pakistan') return 'PK';
  if (lower === 'sa' || lower === 'saudi' || lower === 'saudi arabia' || lower === 'ksa') return 'SA';
  return trimmed;
}

export default { getCountryDisplayName, normalizeCountryCode, CODE_TO_NAME, ALIASES_TO_CODE };
