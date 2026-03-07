/**
 * JSON Exporter Module.
 *
 * Exports processed business records to JSON format.
 *
 * CLIENT REQUIREMENTS:
 * - UTF-8 encoding
 * - Structured JSON format
 * - Both flat and grouped output options
 */

import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

function recordToExportShape(record) {
  const prob = record.probabilityOfMuslimOwnership;
  return {
    uniqueId: record.uniqueId || '',
    businessName: record.businessName || '',
    businessType: record.businessType || '',
    probabilityOfMuslimOwnership:
      prob === '' || prob == null ? 'Low' : prob,
    category: record.category || '',
    address: {
      street: record.street || '',
      city: record.city || '',
      zipCode: record.zipCode || '',
      state: record.state || '',
      country: record.country || '',
    },
    contact: {
      phone: record.phone || '',
      website: record.website || '',
    },
    location: {
      googleMapsLink: record.googleMapsLink || '',
      latitude: record.latitude || null,
      longitude: record.longitude || null,
    },
    openingHours: record.openingHours || '',
    rating: record.rating ?? null,
    review_count: record.review_count ?? null,
    socialMedia: {
      facebook: record.facebook || '',
      instagram: record.instagram || '',
      tiktok: record.tiktok || '',
    },
    dataSource: record.source || '',
    // Pages Jaunes / listing card extras
    activity: record.activity || '',
    description: record.description || '',
    tags: Array.isArray(record.tags) ? record.tags : [],
    detailUrl: record.detailUrl || '',
  };
}

export function initIncrementalJsonl(outputPath) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, '', { encoding: 'utf-8' });
}

export function appendRecordToJsonl(record, outputPath) {
  const line = JSON.stringify(recordToExportShape(record)) + '\n';
  fs.appendFileSync(outputPath, line, { encoding: 'utf-8' });
}

/**
 * Overwrite a JSONL file with the given records (full replace).
 * Used to rewrite the file with UK-only filtered data.
 *
 * @param {Object[]} records - Processed records (flat shape)
 * @param {string} outputPath - Path to the JSONL file
 */
export function writeRecordsToJsonl(records, outputPath) {
  if (!records || records.length === 0) {
    fs.writeFileSync(outputPath, '', { encoding: 'utf-8' });
    return;
  }
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const lines = records.map((r) => JSON.stringify(recordToExportShape(r)) + '\n');
  fs.writeFileSync(outputPath, lines.join(''), { encoding: 'utf-8' });
  logger.info(`[JSONL] Wrote ${records.length} records to ${outputPath}`);
}

/**
 * Read a JSONL file and return records in flat shape (for resume merge).
 *
 * @param {string} outputPath - Path to the JSONL file
 * @returns {Object[]} Flat records (street, city, source, etc.)
 */
export function readJsonlToRecords(outputPath) {
  if (!fs.existsSync(outputPath)) return [];
  const raw = fs.readFileSync(outputPath, 'utf-8').trim();
  if (!raw) return [];
  const lines = raw.split('\n').filter((l) => l.trim());
  const records = [];
  for (const line of lines) {
    try {
      const o = JSON.parse(line);
      records.push({
        uniqueId: o.uniqueId || '',
        businessName: o.businessName || '',
        businessType: o.businessType || '',
        probabilityOfMuslimOwnership:
          o.probabilityOfMuslimOwnership === '' ||
          o.probabilityOfMuslimOwnership == null
            ? 'Low'
            : (o.probabilityOfMuslimOwnership || ''),
        category: o.category || '',
        street: (o.address && o.address.street) || '',
        city: (o.address && o.address.city) || '',
        zipCode: (o.address && o.address.zipCode) || '',
        state: (o.address && o.address.state) || '',
        country: (o.address && o.address.country) || '',
        phone: (o.contact && o.contact.phone) || '',
        website: (o.contact && o.contact.website) || '',
        googleMapsLink: (o.location && o.location.googleMapsLink) || '',
        latitude: (o.location && o.location.latitude) ?? null,
        longitude: (o.location && o.location.longitude) ?? null,
        openingHours: o.openingHours || '',
        rating: o.rating ?? null,
        review_count: o.review_count ?? null,
        facebook: (o.socialMedia && o.socialMedia.facebook) || '',
        instagram: (o.socialMedia && o.socialMedia.instagram) || '',
        tiktok: (o.socialMedia && o.socialMedia.tiktok) || '',
        source: o.dataSource || '',
        activity: o.activity || '',
        description: o.description || '',
        tags: Array.isArray(o.tags) ? o.tags : [],
        detailUrl: o.detailUrl || '',
      });
    } catch (e) {
      // Skip malformed lines
    }
  }
  return records;
}

/**
 * Export records to a JSON file.
 *
 * Output structure:
 * {
 *   metadata: { ... },
 *   data: [ ... ]
 * }
 *
 * @param {Object[]} records - Processed business records
 * @param {string} outputPath - File path for the JSON output
 * @param {Object} [stats=null] - Optional statistics to include
 * @returns {string} Path to the created JSON file
 */
export function exportToJson(records, outputPath, stats = null) {
  if (!records || records.length === 0) {
    logger.warn('[JSON] No records to export');
    return '';
  }

  logger.info(
    `[JSON] Exporting ${records.length} records to ${outputPath}`,
  );

  // Ensure output directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Build output object with metadata
  const output = {
    metadata: {
      exportDate: new Date().toISOString(),
      totalRecords: records.length,
      encoding: 'UTF-8',
      format: 'Muslim Community Business Directory',
      ...(stats ? { statistics: stats } : {}),
    },
    data: records.map((record) => ({
      uniqueId: record.uniqueId || '',
      businessName: record.businessName || '',
      businessType: record.businessType || '',
      probabilityOfMuslimOwnership: record.probabilityOfMuslimOwnership === '' ||
        record.probabilityOfMuslimOwnership == null
        ? 'Low'
        : (record.probabilityOfMuslimOwnership || ''),
      category: record.category || '',
      address: {
        street: record.street || '',
        city: record.city || '',
        zipCode: record.zipCode || '',
        state: record.state || '',
        country: record.country || '',
      },
      contact: {
        phone: record.phone || '',
        website: record.website || '',
      },
      location: {
        googleMapsLink: record.googleMapsLink || '',
        latitude: record.latitude || null,
        longitude: record.longitude || null,
      },
      openingHours: record.openingHours || '',
      rating: record.rating ?? null,
      review_count: record.review_count ?? null,
      socialMedia: {
        facebook: record.facebook || '',
        instagram: record.instagram || '',
        tiktok: record.tiktok || '',
      },
      dataSource: record.source || '',
    })),
  };

  // Write to file with UTF-8 encoding
  // Use 2-space indentation for readability
  const jsonString = JSON.stringify(output, null, 2);
  fs.writeFileSync(outputPath, jsonString, {
    encoding: 'utf-8',
  });

  logger.info(
    `[JSON] Successfully exported to: ${outputPath}`,
  );

  return outputPath;
}

/**
 * Export records to multiple JSON files, split by country.
 *
 * @param {Object[]} records - All processed records
 * @param {string} outputDir - Output directory path
 * @param {string} [prefix='businesses'] - File name prefix
 * @param {Object} [stats=null] - Statistics to include
 * @returns {string[]} Array of created file paths
 */
export function exportToJsonByCountry(
  records,
  outputDir,
  prefix = 'businesses',
  stats = null,
) {
  const filePaths = [];
  const byCountry = {};

  // Group records by country
  for (const record of records) {
    const cc = record.country || 'Unknown';
    if (!byCountry[cc]) byCountry[cc] = [];
    byCountry[cc].push(record);
  }

  // Export each country to a separate file
  for (const [country, countryRecords] of Object.entries(
    byCountry,
  )) {
    const timestamp = new Date()
      .toISOString()
      .split('T')[0];
    const fileName =
      `${prefix}_${country}_${timestamp}.json`;
    const filePath = path.join(outputDir, fileName);

    exportToJson(countryRecords, filePath, stats);
    filePaths.push(filePath);
  }

  return filePaths;
}

export default { exportToJson, exportToJsonByCountry };
