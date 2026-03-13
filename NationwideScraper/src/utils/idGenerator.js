/**
 * Unique ID: {COUNTRY}-{CITY_CODE}-{6-digit}
 * Example: PK-KHI-000001, SA-RUH-000001
 */

import { getCityCode } from '../config/cityCodeMap.js';

const counters = new Map();
const PAD_LENGTH = 6;

export function generateId(country, city) {
  const countryCode = (country || '').toUpperCase();
  const cityCode = getCityCode(city, countryCode);
  const key = `${countryCode}-${cityCode}`;
  const currentCount = counters.get(key) || 0;
  const nextCount = currentCount + 1;
  counters.set(key, nextCount);
  const padded = String(nextCount).padStart(PAD_LENGTH, '0');
  return `${key}-${padded}`;
}

export function resetCounters() {
  counters.clear();
}

export function getCounterState() {
  return Object.fromEntries(counters);
}

export function setCounterState(state) {
  counters.clear();
  if (state && typeof state === 'object') {
    for (const [key, count] of Object.entries(state)) {
      const n = parseInt(count, 10);
      if (!Number.isNaN(n) && n > 0) counters.set(key, n);
    }
  }
}

export default { generateId, resetCounters, getCounterState, setCounterState };
