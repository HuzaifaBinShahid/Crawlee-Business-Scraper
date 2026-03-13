/**
 * Business Categorizer Processor.
 *
 * Tags each business record as either "Chain" or "Independent".
 *
 * CLIENT REQUIREMENT:
 * - Chains: Large supermarket/franchise chains
 *   (Tesco, Aldi, Carrefour, etc.)
 * - Independents: Everything else
 *   (This is the client's MAIN FOCUS)
 *
 * Also assigns the Unique ID to each record.
 */

import { isChain } from '../config/chains.js';
import { getProbabilityOfMuslimOwnership } from '../config/muslimSurnames.js';
import { generateId, resetCounters } from '../utils/idGenerator.js';
import { toTitleCase } from '../utils/normalizer.js';
import logger from '../utils/logger.js';

function categorizeRecord(record) {
  const chainDetected = isChain(
    record.businessName,
    record.country,
  );
  const probability = getProbabilityOfMuslimOwnership(
    record.businessName,
    record.category,
  );
  const businessNameTitleCase = toTitleCase(record.businessName || '');

  return {
    ...record,
    businessName: businessNameTitleCase || record.businessName,
    businessType: chainDetected ? 'Chain' : 'Independent',
    probabilityOfMuslimOwnership: probability,
  };
}

/**
 * Process all records: categorize and assign unique IDs.
 *
 * This is the final processing step before export.
 * It:
 * 1. Tags each record as Chain or Independent
 * 2. Assigns a unique ID in format {COUNTRY}-{CITY}-{NUM}
 * 3. Sorts records by country, city, and category
 *
 * @param {Object[]} records - Deduplicated business records
 * @param {boolean} [freshIds=true] - Reset ID counters first
 * @returns {Object[]} Processed records with IDs and types
 */
export function processRecords(records, freshIds = true) {
  if (!records || records.length === 0) return [];

  logger.info(
    `[Categorizer] Processing ${records.length} records`,
  );

  // Reset ID counters for a fresh set of IDs
  if (freshIds) {
    resetCounters();
  }

  // Sort records for consistent ID assignment
  // Sort by: country -> city -> category -> name
  const sorted = [...records].sort((a, b) => {
    if (a.country !== b.country) {
      return a.country.localeCompare(b.country);
    }
    if (a.city !== b.city) {
      return (a.city || '').localeCompare(b.city || '');
    }
    if (a.category !== b.category) {
      return (a.category || '').localeCompare(
        b.category || '',
      );
    }
    return (a.businessName || '').localeCompare(
      b.businessName || '',
    );
  });

  // Process each record
  const processed = sorted.map((record) => {
    // Categorize as Chain or Independent
    const categorized = categorizeRecord(record);

    // Assign unique ID
    const uniqueId = generateId(
      categorized.country,
      categorized.city,
    );

    return {
      uniqueId,
      ...categorized,
    };
  });

  // Log statistics
  const chainCount = processed.filter(
    (r) => r.businessType === 'Chain',
  ).length;
  const independentCount = processed.filter(
    (r) => r.businessType === 'Independent',
  ).length;

  logger.info(
    `[Categorizer] Complete. ` +
      `Chains: ${chainCount} | ` +
      `Independents: ${independentCount} | ` +
      `Total: ${processed.length}`,
  );

  return processed;
}

export function processSingleRecord(record) {
  const categorized = categorizeRecord(record);
  const uniqueId = generateId(
    categorized.country,
    categorized.city,
  );
  return { uniqueId, ...categorized };
}

/**
 * Get summary statistics for a set of records.
 *
 * @param {Object[]} records - Processed records
 * @returns {Object} Statistics object
 */
export function getStatistics(records) {
  const stats = {
    totalRecords: records.length,
    byCountry: {},
    byCategory: {},
    byType: { Chain: 0, Independent: 0 },
    bySources: {},
    withGps: 0,
    withPhone: 0,
    withWebsite: 0,
    withSocialMedia: 0,
  };

  for (const record of records) {
    // By country
    const cc = record.country || 'Unknown';
    stats.byCountry[cc] = (stats.byCountry[cc] || 0) + 1;

    // By category
    const cat = record.category || 'Uncategorized';
    stats.byCategory[cat] =
      (stats.byCategory[cat] || 0) + 1;

    // By type
    if (record.businessType) {
      stats.byType[record.businessType] =
        (stats.byType[record.businessType] || 0) + 1;
    }

    // By source
    const src = record.source || 'Unknown';
    stats.bySources[src] =
      (stats.bySources[src] || 0) + 1;

    // Data completeness
    if (record.latitude && record.longitude) {
      stats.withGps++;
    }
    if (record.phone) stats.withPhone++;
    if (record.website) stats.withWebsite++;
    if (record.facebook || record.instagram || record.tiktok) {
      stats.withSocialMedia++;
    }
  }

  return stats;
}

export default { processRecords, getStatistics };
