/**
 * France (FR) client export — clean raw format.
 *
 * Exports to client-required fields:
 * Required: external_id, name, category_raw, lat, lon, address, city, postcode,
 * country_code=FR, phone, website, source, source_url
 * Optional: opening_hours, rating, review_count, photos_count, tags
 *
 * Rules: lat/lon not empty, inside France, external_id unique, name not empty,
 * no obvious duplicates (same name + city + very close coords).
 */

import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';
import { filterToFrOnly } from '../processors/frRecordFilter.js';

/** Build full address string from parts */
function fullAddress(record) {
  const parts = [
    record.street,
    record.zipCode ? record.zipCode.trim() : '',
    record.city,
    record.state,
  ].filter(Boolean);
  return parts.join(', ').trim() || '';
}

/** Normalize source label for client */
function sourceLabel(record) {
  const s = (record.source || '').toLowerCase();
  if (s.includes('google') || s === 'google maps') return 'google_maps';
  if (s.includes('pagesjaunes') || s.includes('pages jaunes')) return 'pages_jaunes';
  if (s.includes('yell')) return 'yell_uk';
  return s || 'google_maps';
}

/**
 * Map internal record to client FR export shape.
 * Only call with records that already passed isValidFrRecord.
 *
 * @param {Object} record - Processed record (has uniqueId, businessName, etc.)
 * @returns {Object} Client-format record
 */
export function toFrClientRecord(record) {
  const lat = record.latitude;
  const lng = record.longitude;
  const numLat = typeof lat === 'number' ? lat : parseFloat(lat);
  const numLon = typeof lng === 'number' ? lng : parseFloat(lng);

  return {
    external_id: record.uniqueId || '',
    name: (record.businessName || '').trim(),
    category_raw: record.category || '',
    lat: Number.isNaN(numLat) ? null : numLat,
    lon: Number.isNaN(numLon) ? null : numLon,
    address: fullAddress(record),
    city: (record.city || '').trim(),
    postcode: (record.zipCode || '').trim(),
    country_code: 'FR',
    phone: (record.phone || '').trim() || null,
    website: (record.website || '').trim() || null,
    source: sourceLabel(record),
    source_url: (record.googleMapsLink || '').trim() || null,
    opening_hours: (record.openingHours || '').trim() || null,
    rating: record.rating ?? null,
    review_count: record.review_count ?? null,
    photos_count: record.photos_count ?? null,
    photos_urls: record.photos_urls ?? null,
    tags: record.tags ?? null,
  };
}

/** Dedupe: same name + same city + coords within ~0.001 deg (~100m) */
const COORD_EPS = 0.001;

function dedupeFrRecords(records) {
  if (!records || records.length === 0) return [];
  const seen = new Map();
  const out = [];

  for (const r of records) {
    const name = (r.businessName || '').toLowerCase().trim();
    const city = (r.city || '').toLowerCase().trim();
    const lat = typeof r.latitude === 'number' ? r.latitude : parseFloat(r.latitude);
    const lon = typeof r.longitude === 'number' ? r.longitude : parseFloat(r.longitude);

    const key = `${name}|${city}`;
    const existing = seen.get(key);
    if (existing) {
      const dLat = Math.abs(existing.lat - lat);
      const dLon = Math.abs(existing.lon - lon);
      if (dLat <= COORD_EPS && dLon <= COORD_EPS) continue;
    }
    seen.set(key, { lat, lon });
    out.push(r);
  }

  if (out.length < records.length) {
    logger.info(
      `[FR export] Dedupe: removed ${records.length - out.length} ` +
        `(same name+city+close coords). Remaining: ${out.length}`,
    );
  }
  return out;
}

/**
 * Export FR records to client CSV (client column names).
 *
 * @param {Object[]} clientRecords - Already in client shape (toFrClientRecord)
 * @param {string} outputPath
 * @returns {string}
 */
export function exportFrClientCsv(clientRecords, outputPath) {
  if (!clientRecords || clientRecords.length === 0) {
    logger.warn('[FR export] No records to write to CSV');
    return '';
  }

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const headers = [
    'external_id', 'name', 'category_raw', 'lat', 'lon', 'address',
    'city', 'postcode', 'country_code', 'phone', 'website', 'source',
    'source_url', 'opening_hours', 'rating', 'review_count',
    'photos_count', 'photos_urls', 'tags',
  ];
  const escape = (v) => {
    if (v === null || v === undefined) return '""';
    const s = String(v);
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return '"' + s + '"';
  };

  const headerLine = '\uFEFF' + headers.join(',') + '\n';
  const rows = clientRecords.map((r) =>
    headers.map((h) => escape(r[h])).join(','),
  );
  fs.writeFileSync(outputPath, headerLine + rows.join('\n') + '\n', 'utf-8');
  logger.info(
    `[FR export] CSV written: ${outputPath} (${clientRecords.length} records)`,
  );
  return outputPath;
}

/**
 * Export FR records to NDJSON (one JSON object per line).
 *
 * @param {Object[]} clientRecords
 * @param {string} outputPath
 * @returns {string}
 */
export function exportFrClientNdjson(clientRecords, outputPath) {
  if (!clientRecords || clientRecords.length === 0) {
    logger.warn('[FR export] No records to write to NDJSON');
    return '';
  }

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const lines = clientRecords.map((r) => JSON.stringify(r)).join('\n');
  fs.writeFileSync(outputPath, lines + (lines ? '\n' : ''), 'utf-8');
  logger.info(
    `[FR export] NDJSON written: ${outputPath} (${clientRecords.length} records)`,
  );
  return outputPath;
}

/**
 * Prepare and export FR data for client: filter, dedupe, map to client format, write CSV + NDJSON.
 *
 * @param {Object[]} processedRecords - After processRecords (have uniqueId, etc.)
 * @param {string} outputDir
 * @param {Object} options - { sampleSize: number | null, timestamp: string }
 * @returns {{ csvPath: string, ndjsonPath: string, count: number }}
 */
export function prepareAndExportFrClient(
  processedRecords,
  outputDir,
  options = {},
) {
  const filtered = filterToFrOnly(processedRecords, 'FR client export');
  if (filtered.length === 0) {
    logger.warn('[FR export] No records left after FR filter');
    return { csvPath: '', ndjsonPath: '', count: 0 };
  }

  const deduped = dedupeFrRecords(filtered);
  const sampleSize = options.sampleSize ?? null;
  const toExport =
    sampleSize != null ? deduped.slice(0, sampleSize) : deduped;
  const clientRecords = toExport.map(toFrClientRecord);

  const timestamp =
    options.timestamp || new Date().toISOString().split('T')[0];
  const suffix = sampleSize != null ? `_sample_${sampleSize}` : '_full';
  const prefix = `businesses_FR_client${suffix}_${timestamp}`;
  const csvPath = path.join(outputDir, `${prefix}.csv`);
  const ndjsonPath = path.join(outputDir, `${prefix}.ndjson`);

  exportFrClientCsv(clientRecords, csvPath);
  exportFrClientNdjson(clientRecords, ndjsonPath);

  return { csvPath, ndjsonPath, count: clientRecords.length };
}

export default {
  toFrClientRecord,
  dedupeFrRecords,
  exportFrClientCsv,
  exportFrClientNdjson,
  prepareAndExportFrClient,
};
