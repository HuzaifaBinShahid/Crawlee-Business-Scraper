/**
 * Unique ID Generator.
 *
 * Generates IDs in the format: {COUNTRY}-{CITY_CODE}-{INCREMENT}
 * Examples: UK-LON-001, FR-PAR-001, UK-MAN-042
 *
 * Maintains separate counters for each country-city combination
 * to ensure uniqueness across the entire dataset.
 */

import { getCityCode } from '../config/cityCodeMap.js';

/**
 * Stores counters per country-city pair.
 * Key format: "UK-LON", "FR-PAR", etc.
 * @type {Map<string, number>}
 */
const counters = new Map();

/**
 * Generate a unique ID for a business record.
 *
 * @param {string} country - Country code (UK, FR, DE, IT)
 * @param {string} city - City name
 * @returns {string} Unique ID (e.g., "UK-LON-001")
 */
export function generateId(country, city) {
  const countryCode = country.toUpperCase();
  const cityCode = getCityCode(city, countryCode);
  const key = `${countryCode}-${cityCode}`;

  // Increment counter for this country-city pair
  const currentCount = counters.get(key) || 0;
  const nextCount = currentCount + 1;
  counters.set(key, nextCount);

  // Pad the increment to 3 digits (or more if needed)
  const paddedNum = String(nextCount).padStart(3, '0');

  return `${key}-${paddedNum}`;
}

/**
 * Reset all ID counters.
 * Useful when starting a fresh scrape.
 */
export function resetCounters() {
  counters.clear();
}

/**
 * Restore counter state from a previous run (for resume).
 *
 * @param {Object} state - Map of key (e.g. "UK-LON") to count
 */
export function setCounterState(state) {
  counters.clear();
  if (state && typeof state === 'object') {
    for (const [key, count] of Object.entries(state)) {
      const n = parseInt(count, 10);
      if (!Number.isNaN(n) && n > 0) counters.set(key, n);
    }
  }
}

/**
 * Get current counter state (for debugging/logging).
 * @returns {Object} Current counter values
 */
export function getCounterState() {
  return Object.fromEntries(counters);
}

export default { generateId, resetCounters, getCounterState };
