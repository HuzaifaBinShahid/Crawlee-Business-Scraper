/**
 * CSV export for internal record shape (uniqueId, businessName, category, etc.).
 */

import fs from 'fs';
import path from 'path';
import { stringify } from 'csv-stringify/sync';
import logger from '../utils/logger.js';

const CSV_COLUMNS = [
  { key: 'uniqueId', header: 'Unique ID' },
  { key: 'businessName', header: 'Business Name' },
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
  { key: 'source', header: 'Data Source' },
  { key: 'scraped_at', header: 'Scraped At' },
];

function escapeCsvValue(value) {
  if (value === null || value === undefined) return '""';
  const s = String(value);
  if (s.includes('"') || s.includes(',') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
  return '"' + s + '"';
}

/** Header line for internal CSV (with BOM). Use for streaming write. */
export function getCsvHeaderLine() {
  const headers = CSV_COLUMNS.map((c) => c.header);
  return '\uFEFF' + headers.map((h) => escapeCsvValue(h)).join(',') + '\n';
}

/** Single CSV row for one record. Append after header for streaming. */
export function recordToCsvRow(record) {
  const values = CSV_COLUMNS.map((col) => {
    let value = record[col.key];
    if (value === null || value === undefined) value = '';
    if (typeof value === 'number') value = String(value);
    return escapeCsvValue(value);
  });
  return values.join(',') + '\n';
}

export function exportToCsv(records, outputPath) {
  if (!records || records.length === 0) { logger.warn('[CSV] No records'); return ''; }
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const rows = records.map((record) => {
    const row = {};
    for (const col of CSV_COLUMNS) {
      let value = record[col.key];
      if (value === null || value === undefined) value = '';
      if (typeof value === 'number') value = String(value);
      row[col.header] = value;
    }
    return row;
  });
  const csvString = stringify(rows, { header: true, columns: CSV_COLUMNS.map((c) => c.header), bom: true, quoted: true, quoted_empty: true });
  fs.writeFileSync(outputPath, csvString, { encoding: 'utf-8' });
  logger.info(`[CSV] Exported ${records.length} to ${outputPath}`);
  return outputPath;
}

export default { exportToCsv, getCsvHeaderLine, recordToCsvRow };
