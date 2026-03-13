/**
 * UK-only record validator.
 *
 * Ensures the UK dataset contains only genuine UK businesses.
 * Excludes US and other non-UK entries (wrong country code, "United States"
 * in address, coordinates outside UK bounds, or null coords with US signals).
 */

import logger from '../utils/logger.js';

// UK geographic bounds (approx: England, Scotland, Wales, N.Ireland)
const UK_BOUNDS = {
  latMin: 49.5,
  latMax: 61,
  lngMin: -9,
  lngMax: 2.5,
};

function isWithinUkBounds(lat, lng) {
  if (lat == null || lng == null) return false;
  return (
    lat >= UK_BOUNDS.latMin &&
    lat <= UK_BOUNDS.latMax &&
    lng >= UK_BOUNDS.lngMin &&
    lng <= UK_BOUNDS.lngMax
  );
}

/** Normalized phone for country-code check (e.g. "+1 205" -> "+1") */
function getPhoneCountrySignal(phone) {
  if (!phone || typeof phone !== 'string') return '';
  const t = phone.trim();
  const match = t.match(/^\s*(\+\d{1,3})/);
  return match ? match[1] : '';
}

/** True if address parts or combined string suggest US/non-UK */
function hasUnitedStatesInAddress(record) {
  const parts = [
    record.street,
    record.city,
    record.state,
    record.zipCode,
    record.googleMapsLink,
  ].filter(Boolean);
  const combined = parts.join(' ').toLowerCase();
  const patterns = [
    'united states',
    ', us',
    ', usa',
    ' u.s.',
    ' u.s.a.',
    ' al 35',
    ' al 36',
  ];
  return patterns.some((p) => combined.includes(p));
}

/**
 * Returns true only if the record is a valid UK entry for the UK dataset.
 *
 * @param {Object} record - Processed record
 * @returns {boolean}
 */
export function isValidUkRecord(record) {
  if (!record) return false;
  const country = (record.country || '').toString().toUpperCase();
  if (country !== 'UK') return true;

  const phone = record.phone || '';
  const phoneCountry = getPhoneCountrySignal(phone);
  const lat = record.latitude;
  const lng = record.longitude;
  const hasUsInAddress = hasUnitedStatesInAddress(record);

  if (phoneCountry === '+1') return false;
  if (hasUsInAddress) return false;
  if (phoneCountry && phoneCountry !== '+44') return false;
  if (lat != null && lng != null && !isWithinUkBounds(lat, lng)) return false;

  const coordsNull = (lat == null || lat === '') && (lng == null || lng === '');
  if (coordsNull && (phoneCountry === '+1' || hasUsInAddress)) return false;

  return true;
}

/**
 * Filter records to only valid UK entries. Logs removed count.
 */
export function filterToUkOnly(records, context = 'UK filter') {
  if (!records || records.length === 0) return [];
  const filtered = records.filter(isValidUkRecord);
  const removed = records.length - filtered.length;
  if (removed > 0) {
    logger.info(
      `[${context}] Removed ${removed} non-UK/US records. Remaining: ${filtered.length}`,
    );
  }
  return filtered;
}

export default { isValidUkRecord, filterToUkOnly };
