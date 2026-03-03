/**
 * France-only record validator.
 *
 * Ensures the France (FR) dataset contains only valid FR businesses:
 * - Name must not be empty
 * - Latitude/longitude must not be empty and must be inside France
 * - Phone must be France (+33) or empty; reject +1, +44, etc.
 * - Reject address/phone signals from other countries
 */

import logger from '../utils/logger.js';

// France geographic bounds (mainland + Corsica)
const FR_BOUNDS = {
  latMin: 41.2,
  latMax: 51.2,
  lngMin: -5.5,
  lngMax: 10,
};

function isWithinFranceBounds(lat, lng) {
  if (lat == null || lng == null) return false;
  return (
    lat >= FR_BOUNDS.latMin &&
    lat <= FR_BOUNDS.latMax &&
    lng >= FR_BOUNDS.lngMin &&
    lng <= FR_BOUNDS.lngMax
  );
}

/** Normalized phone country code (e.g. "+1 205" -> "+1", "+33 1" -> "+33") */
function getPhoneCountrySignal(phone) {
  if (!phone || typeof phone !== 'string') return '';
  const t = phone.trim();
  const match = t.match(/^\s*(\+\d{1,3})/);
  return match ? match[1] : '';
}

/** True if phone is non-France (e.g. +1, +44) */
function hasNonFrancePhone(record) {
  const phone = record.phone || '';
  if (!phone.trim()) return false;
  const sig = getPhoneCountrySignal(phone);
  if (sig === '+33') return false;
  if (/^0[1-9]/.test(phone.trim())) return false; // French local
  if (!sig) return false; // no country code, allow
  return true; // +1, +44, etc.
}

/**
 * Returns true only if the record is valid for the France client export.
 * Required: name, lat, lon inside France, FR phone or empty.
 *
 * @param {Object} record - Processed record
 * @returns {boolean}
 */
export function isValidFrRecord(record) {
  if (!record) return false;

  const name = (record.businessName || '').toString().trim();
  if (!name) return false;

  const lat = record.latitude;
  const lng = record.longitude;
  if (lat == null || lng == null || lat === '' || lng === '') return false;
  const numLat = typeof lat === 'number' ? lat : parseFloat(lat);
  const numLng = typeof lng === 'number' ? lng : parseFloat(lng);
  if (Number.isNaN(numLat) || Number.isNaN(numLng)) return false;
  if (!isWithinFranceBounds(numLat, numLng)) return false;

  if (hasNonFrancePhone(record)) return false;

  return true;
}

/**
 * Filter records to only valid France entries. Logs removed count.
 *
 * @param {Object[]} records
 * @param {string} [context='FR filter']
 * @returns {Object[]}
 */
export function filterToFrOnly(records, context = 'FR filter') {
  if (!records || records.length === 0) return [];
  const filtered = records.filter(isValidFrRecord);
  const removed = records.length - filtered.length;
  if (removed > 0) {
    logger.info(
      `[${context}] Removed ${removed} non-FR/invalid records. ` +
        `Remaining: ${filtered.length}`,
    );
  }
  return filtered;
}

export { isWithinFranceBounds, FR_BOUNDS };
export default { isValidFrRecord, filterToFrOnly, isWithinFranceBounds };
