/**
 * Deduplication Processor.
 *
 * Removes duplicate records across multiple data sources
 * (Google Maps, Yell.co.uk, PagesJaunes.fr).
 *
 * Uses fuzzy string matching to detect duplicates even when
 * business names or addresses differ slightly between sources.
 *
 * When a duplicate is found, the record with the MOST data
 * fields populated is kept. Missing fields from the secondary
 * record are merged into the primary.
 *
 * CLIENT REQUIREMENT: "High accuracy with Zero Duplicates"
 */

import { compareTwoStrings } from 'string-similarity';
import logger from '../utils/logger.js';

// Minimum similarity threshold for name matching (0.0 to 1.0)
const NAME_SIMILARITY_THRESHOLD = 0.75;

// Minimum similarity threshold for address matching
const ADDRESS_SIMILARITY_THRESHOLD = 0.65;

/**
 * Calculate a "completeness" score for a record.
 * Higher score = more fields populated.
 *
 * @param {Object} record - Business record
 * @returns {number} Completeness score
 */
function getCompletenessScore(record) {
  let score = 0;
  const fields = [
    'businessName', 'street', 'city', 'zipCode',
    'state', 'phone', 'website', 'googleMapsLink',
    'latitude', 'longitude', 'openingHours',
    'facebook', 'instagram', 'tiktok',
  ];

  for (const field of fields) {
    if (record[field] !== null &&
        record[field] !== undefined &&
        record[field] !== '') {
      score++;
      // Bonus points for critical fields
      if (['googleMapsLink', 'latitude', 'longitude']
        .includes(field)) {
        score += 2;
      }
      if (['facebook', 'instagram'].includes(field)) {
        score += 1;
      }
    }
  }

  return score;
}

/**
 * Merge two records, keeping the most complete data.
 * The primary record takes precedence, but empty fields
 * are filled from the secondary record.
 *
 * @param {Object} primary - Primary record (more complete)
 * @param {Object} secondary - Secondary record
 * @returns {Object} Merged record
 */
function mergeRecords(primary, secondary) {
  const merged = { ...primary };

  // List of mergeable fields
  const mergeableFields = [
    'street', 'city', 'zipCode', 'state', 'phone',
    'website', 'googleMapsLink', 'latitude', 'longitude',
    'openingHours', 'facebook', 'instagram', 'tiktok',
  ];

  for (const field of mergeableFields) {
    // If primary is empty but secondary has data, use secondary
    if (
      (!merged[field] ||
        merged[field] === '' ||
        merged[field] === null) &&
      secondary[field] &&
      secondary[field] !== '' &&
      secondary[field] !== null
    ) {
      merged[field] = secondary[field];
    }
  }

  // Track which sources contributed to this record
  const sources = new Set();
  if (primary.source) sources.add(primary.source);
  if (secondary.source) sources.add(secondary.source);
  merged.source = Array.from(sources).join(' + ');

  return merged;
}

/**
 * Check if two records are likely duplicates.
 *
 * @param {Object} a - First record
 * @param {Object} b - Second record
 * @returns {boolean} True if records are likely duplicates
 */
function areDuplicates(a, b) {
  // Must be in the same country
  if (a.country !== b.country) return false;

  // Compare business names using fuzzy matching
  const nameA = (a.businessName || '').toLowerCase().trim();
  const nameB = (b.businessName || '').toLowerCase().trim();

  if (!nameA || !nameB) return false;

  // Exact match
  if (nameA === nameB) {
    // If same name, check if same city too
    const cityA = (a.city || '').toLowerCase().trim();
    const cityB = (b.city || '').toLowerCase().trim();
    if (cityA && cityB) {
      return (
        compareTwoStrings(cityA, cityB) >
        ADDRESS_SIMILARITY_THRESHOLD
      );
    }
    return true;
  }

  // Fuzzy name match
  const nameSimilarity = compareTwoStrings(nameA, nameB);
  if (nameSimilarity < NAME_SIMILARITY_THRESHOLD) {
    return false;
  }

  // If names are similar, also check address similarity
  const addrA = `${a.street || ''} ${a.city || ''} ${a.zipCode || ''}`
    .toLowerCase()
    .trim();
  const addrB = `${b.street || ''} ${b.city || ''} ${b.zipCode || ''}`
    .toLowerCase()
    .trim();

  if (addrA && addrB) {
    const addrSimilarity = compareTwoStrings(addrA, addrB);
    return addrSimilarity > ADDRESS_SIMILARITY_THRESHOLD;
  }

  // If no address to compare, rely on name similarity
  // with a higher threshold
  return nameSimilarity > 0.85;
}

/**
 * Deduplicate an array of business records.
 *
 * Strategy:
 * 1. Sort records by completeness (most complete first)
 * 2. For each record, check against all "unique" records
 * 3. If a duplicate is found, merge and keep the most complete
 * 4. If no duplicate, add to unique list
 *
 * @param {Object[]} records - Array of business records
 * @returns {Object[]} Deduplicated array
 */
export function deduplicateRecords(records) {
  if (!records || records.length === 0) return [];

  logger.info(
    `[Dedup] Starting deduplication of ${records.length} records`,
  );

  // Sort by completeness score (descending)
  const sorted = [...records].sort(
    (a, b) =>
      getCompletenessScore(b) - getCompletenessScore(a),
  );

  const uniqueRecords = [];

  for (const record of sorted) {
    let isDuplicate = false;

    for (let i = 0; i < uniqueRecords.length; i++) {
      if (areDuplicates(record, uniqueRecords[i])) {
        // Merge the duplicate into the existing record
        uniqueRecords[i] = mergeRecords(
          uniqueRecords[i],
          record,
        );
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      uniqueRecords.push({ ...record });
    }
  }

  const removedCount = records.length - uniqueRecords.length;
  logger.info(
    `[Dedup] Complete. Removed ${removedCount} duplicates. ` +
      `Unique records: ${uniqueRecords.length}`,
  );

  return uniqueRecords;
}

export default { deduplicateRecords };
