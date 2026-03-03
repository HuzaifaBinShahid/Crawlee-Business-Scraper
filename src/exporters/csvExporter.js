/**
 * CSV Exporter Module.
 *
 * Exports processed business records to CSV format.
 *
 * CLIENT REQUIREMENTS:
 * - UTF-8 encoding (crucial for German and Turkish characters)
 * - Structured CSV format
 * - All required data fields
 */

import fs from 'fs';
import path from 'path';
import { stringify } from 'csv-stringify/sync';
import logger from '../utils/logger.js';

function escapeCsvValue(value) {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return '"' + str + '"';
}

/**
 * Column definitions for the CSV output.
 * Maps internal field names to display headers.
 */
const CSV_COLUMNS = [
  { key: 'uniqueId', header: 'Unique ID' },
  { key: 'businessName', header: 'Business Name' },
  { key: 'businessType', header: 'Type (Chain/Independent)' },
  { key: 'probabilityOfMuslimOwnership', header: 'Probability of Muslim Ownership' },
  { key: 'category', header: 'Category' },
  { key: 'street', header: 'Street' },
  { key: 'city', header: 'City' },
  { key: 'zipCode', header: 'Zip Code' },
  { key: 'state', header: 'State/Region' },
  { key: 'country', header: 'Country' },
  { key: 'phone', header: 'Phone Number' },
  { key: 'website', header: 'Website URL' },
  { key: 'googleMapsLink', header: 'Google Maps Link' },
  { key: 'latitude', header: 'Latitude' },
  { key: 'longitude', header: 'Longitude' },
  { key: 'openingHours', header: 'Opening Hours' },
  { key: 'rating', header: 'Rating' },
  { key: 'review_count', header: 'Review Count' },
  { key: 'facebook', header: 'Facebook' },
  { key: 'instagram', header: 'Instagram' },
  { key: 'tiktok', header: 'TikTok' },
  { key: 'source', header: 'Data Source' },
];

export function initIncrementalCsv(outputPath) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const header = CSV_COLUMNS.map((col) => col.header).join(',');
  fs.writeFileSync(outputPath, '\uFEFF' + header + '\n', {
    encoding: 'utf-8',
  });
}

export function appendRecordToCsv(record, outputPath) {
  const values = CSV_COLUMNS.map((col) => {
    let v = record[col.key];
    if (v === null || v === undefined) v = '';
    if (typeof v === 'number') v = String(v);
    return escapeCsvValue(v);
  });
  fs.appendFileSync(outputPath, values.join(',') + '\n', {
    encoding: 'utf-8',
  });
}

/**
 * Export records to a CSV file.
 *
 * @param {Object[]} records - Processed business records
 * @param {string} outputPath - File path for the CSV output
 * @returns {string} Path to the created CSV file
 */
export function exportToCsv(records, outputPath) {
  if (!records || records.length === 0) {
    logger.warn('[CSV] No records to export');
    return '';
  }

  logger.info(
    `[CSV] Exporting ${records.length} records to ${outputPath}`,
  );

  // Ensure output directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Prepare rows using column definitions
  const rows = records.map((record) => {
    const row = {};
    for (const col of CSV_COLUMNS) {
      let value = record[col.key];

      // Handle null/undefined values
      if (value === null || value === undefined) {
        value = '';
      }

      // Convert numbers to strings
      if (typeof value === 'number') {
        value = String(value);
      }

      row[col.header] = value;
    }
    return row;
  });

  // Generate CSV string with UTF-8 BOM for Excel compatibility
  const csvString = stringify(rows, {
    header: true,
    columns: CSV_COLUMNS.map((col) => col.header),
    bom: true, // UTF-8 BOM for Excel
    quoted: true,
    quoted_empty: true,
  });

  // Write to file with UTF-8 encoding
  fs.writeFileSync(outputPath, csvString, {
    encoding: 'utf-8',
  });

  logger.info(
    `[CSV] Successfully exported to: ${outputPath}`,
  );

  return outputPath;
}

/**
 * Export records to multiple CSV files, split by country.
 *
 * @param {Object[]} records - All processed records
 * @param {string} outputDir - Output directory path
 * @param {string} [prefix='businesses'] - File name prefix
 * @returns {string[]} Array of created file paths
 */
export function exportToCsvByCountry(
  records,
  outputDir,
  prefix = 'businesses',
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
      `${prefix}_${country}_${timestamp}.csv`;
    const filePath = path.join(outputDir, fileName);

    exportToCsv(countryRecords, filePath);
    filePaths.push(filePath);
  }

  return filePaths;
}

export default { exportToCsv, exportToCsvByCountry };
