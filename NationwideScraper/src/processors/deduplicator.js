/**
 * Deduplicate by name + GPS proximity (~0.001 deg).
 * Same name + same location (within tolerance) = duplicate, regardless of city string.
 * Ensures duplicates are removed from all outputs (CSV, JSON, client export).
 */

import logger from '../utils/logger.js';

const ROUND = 4;

function coordKey(lat, lon) {
  if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) return '';
  const rnd = (v) => Math.round(v * 10 ** ROUND) / 10 ** ROUND;
  return `${rnd(lat)}|${rnd(lon)}`;
}

/**
 * Dedupe by name + location (same name and coords within ~0.001 deg = duplicate).
 * @param {Object[]} records - Records with businessName, latitude, longitude
 * @returns {Object[]} Deduplicated; first occurrence of each (name + location) kept
 */
export function deduplicateRecords(records) {
  if (!records || records.length === 0) return [];
  const seen = new Map();
  const out = [];
  for (const r of records) {
    const name = (r.businessName || '').toLowerCase().trim();
    if (!name) continue;
    const lat = typeof r.latitude === 'number' ? r.latitude : parseFloat(r.latitude);
    const lon = typeof r.longitude === 'number' ? r.longitude : parseFloat(r.longitude);
    const key = `${name}|${coordKey(lat, lon)}`;
    if (seen.has(key)) continue;
    seen.set(key, { lat, lon });
    out.push(r);
  }
  if (out.length < records.length) {
    logger.info(`[Dedup] Removed ${records.length - out.length} duplicates (name + location). Remaining: ${out.length}`);
  }
  return out;
}

export default { deduplicateRecords };
