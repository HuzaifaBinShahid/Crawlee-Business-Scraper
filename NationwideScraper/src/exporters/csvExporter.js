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
];

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

export default { exportToCsv };
