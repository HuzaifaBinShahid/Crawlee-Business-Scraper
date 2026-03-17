/**
 * JSON export with metadata and data array.
 */

import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

/** One record in the JSON export shape. Also used for NDJSON streaming. */
export function recordToExportShape(record) {
  return {
    uniqueId: record.uniqueId || '',
    businessName: record.businessName || '',
    category: record.category || '',
    address: { street: record.street || '', city: record.city || '', zipCode: record.zipCode || '', state: record.state || '', country: record.country || '' },
    contact: { phone: record.phone || '', website: record.website || '' },
    location: { googleMapsLink: record.googleMapsLink || '', latitude: record.latitude ?? null, longitude: record.longitude ?? null },
    openingHours: record.openingHours || '',
    rating: record.rating ?? null,
    review_count: record.review_count ?? null,
    dataSource: record.source || '',
  };
}

/** Write final .json (metadata + data array) from an NDJSON file. Call after streaming is done. */
export function finishJsonFromNdjson(ndjsonPath, jsonPath, totalRecords) {
  if (!fs.existsSync(ndjsonPath)) { logger.warn('[JSON] NDJSON file missing'); return ''; }
  const lines = fs.readFileSync(ndjsonPath, 'utf-8').split('\n').filter((l) => l.trim());
  const data = lines.map((l) => {
    try { return JSON.parse(l); } catch (e) { return null; }
  }).filter(Boolean);
  const output = {
    metadata: {
      exportDate: new Date().toISOString(),
      totalRecords: data.length,
      encoding: 'UTF-8',
      ...(totalRecords != null ? { statistics: { totalRecords } } : {}),
    },
    data,
  };
  fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2), 'utf-8');
  logger.info(`[JSON] Wrote ${jsonPath} (${data.length} records from NDJSON)`);
  return jsonPath;
}

export function exportToJson(records, outputPath, stats = null) {
  if (!records || records.length === 0) { logger.warn('[JSON] No records'); return ''; }
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const output = {
    metadata: {
      exportDate: new Date().toISOString(),
      totalRecords: records.length,
      encoding: 'UTF-8',
      ...(stats ? { statistics: stats } : {}),
    },
    data: records.map(recordToExportShape),
  };
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  logger.info(`[JSON] Exported ${records.length} to ${outputPath}`);
  return outputPath;
}

export default { exportToJson, recordToExportShape, finishJsonFromNdjson };
