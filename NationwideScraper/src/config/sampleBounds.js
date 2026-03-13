/**
 * Bounding boxes for sample mode: only keep records inside these regions.
 * PK sample = Karachi only; SA sample = Riyadh only.
 */

import logger from '../utils/logger.js';

const SAMPLE_BOUNDS = {
  PK: {
    latMin: 24.72,
    latMax: 25.22,
    lngMin: 66.90,
    lngMax: 67.45,
  },
  SA: {
    latMin: 24.38,
    latMax: 25.05,
    lngMin: 46.48,
    lngMax: 47.05,
  },
};

/**
 * @param {Object} record - Has latitude, longitude
 * @param {string} countryCode - PK or SA
 * @returns {boolean}
 */
export function isWithinSampleRegion(record, countryCode) {
  const bounds = SAMPLE_BOUNDS[countryCode];
  if (!bounds) return true;
  const lat = typeof record.latitude === 'number' ? record.latitude : parseFloat(record.latitude);
  const lng = typeof record.longitude === 'number' ? record.longitude : parseFloat(record.longitude);
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return false;
  return lat >= bounds.latMin && lat <= bounds.latMax && lng >= bounds.lngMin && lng <= bounds.lngMax;
}

/**
 * Filter records to sample region when in sample mode for PK or SA.
 * @param {Object[]} records
 * @param {string} countryCode
 * @param {boolean} isSample
 * @returns {Object[]}
 */
export function filterToSampleRegion(records, countryCode, isSample) {
  if (!isSample || !records || records.length === 0) return records || [];
  const code = (countryCode || '').toUpperCase();
  if (code !== 'PK' && code !== 'SA') return records;
  const filtered = records.filter((r) => isWithinSampleRegion(r, code));
  if (filtered.length < records.length) {
    logger.info(`[Sample region] Kept ${filtered.length} records inside ${code === 'PK' ? 'Karachi' : 'Riyadh'} (removed ${records.length - filtered.length} outside)`);
  }
  return filtered;
}

export default SAMPLE_BOUNDS;
