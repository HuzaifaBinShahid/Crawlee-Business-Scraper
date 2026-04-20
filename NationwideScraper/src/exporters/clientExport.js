import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';
import { toTitleCase } from '../processors/normalizer.js';
import { getCountryDisplayName } from '../config/countryNames.js';

function fullAddress(record) {
  const parts = [record.street, record.zipCode ? record.zipCode.trim() : '', record.city, record.state].filter(Boolean);
  return parts.join(', ').trim() || '';
}

function sourceLabel(record) {
  const s = (record.source || '').toLowerCase();
  if (s.includes('google') || s === 'google maps') return 'google_maps';
  if (s.includes('yellow')) return 'yellow_pages';
  return s || 'google_maps';
}

/**
 * Produce a record in the exact client-specified schema:
 *   external_id, name, category, address, city, postcode, country_code,
 *   phone, website, latitude, longitude, opening_hours, source, source_url
 * Plus metadata: scraped_at, category_raw, country, city
 */
export function toClientRecord(record) {
  const lat = record.latitude;
  const lng = record.longitude;
  const numLat = typeof lat === 'number' ? lat : parseFloat(lat);
  const numLon = typeof lng === 'number' ? lng : parseFloat(lng);
  const categoryRaw = (record.category || '').trim();
  const categoryTitled = toTitleCase(categoryRaw) || categoryRaw;
  const countryCode = (record.country || '').trim().toUpperCase() || null;
  const countryFull = countryCode ? getCountryDisplayName(countryCode) || countryCode : null;

  return {
    // ─── Main client schema ────────────────────────────────────
    external_id: record.uniqueId || '',
    name: (record.businessName || '').trim(),
    category: categoryTitled || null,
    address: fullAddress(record),
    city: (record.city || '').trim(),
    postcode: (record.zipCode || '').trim() || null,
    country_code: countryCode,
    phone: (record.phone || '').trim() || null,
    website: (record.website || '').trim() || null,
    latitude: Number.isNaN(numLat) ? null : numLat,
    longitude: Number.isNaN(numLon) ? null : numLon,
    opening_hours: (record.openingHours || '').trim() || null,
    source: sourceLabel(record),
    source_url: (record.googleMapsLink || '').trim() || null,
    // ─── Metadata ──────────────────────────────────────────────
    scraped_at: record.scraped_at || new Date().toISOString(),
    category_raw: categoryRaw || null,
    country: countryFull,
    // ─── Bonus quality signals (not required by client, harmless extras) ──
    rating: record.rating ?? null,
    review_count: record.review_count ?? null,
  };
}

const ROUND = 4;

function coordKey(lat, lon) {
  if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) return '';
  const rnd = (v) => Math.round(v * 10 ** ROUND) / 10 ** ROUND;
  return `${rnd(lat)}|${rnd(lon)}`;
}

export function dedupeClientRecords(records) {
  if (!records || records.length === 0) return [];
  const seen = new Set();
  const out = [];
  for (const r of records) {
    const name = (r.businessName || '').toLowerCase().trim();
    const lat = typeof r.latitude === 'number' ? r.latitude : parseFloat(r.latitude);
    const lon = typeof r.longitude === 'number' ? r.longitude : parseFloat(r.longitude);
    const key = `${name}|${coordKey(lat, lon)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  if (out.length < records.length) logger.info(`[Client export] Dedupe: removed ${records.length - out.length}. Remaining: ${out.length}`);
  return out;
}

// Column order matches client's standardized schema: main fields first, then metadata, then bonus.
const HEADERS = [
  'external_id', 'name', 'category', 'address', 'city', 'postcode',
  'country_code', 'phone', 'website', 'latitude', 'longitude',
  'opening_hours', 'source', 'source_url',
  // Metadata
  'scraped_at', 'category_raw', 'country',
  // Bonus
  'rating', 'review_count',
];

function escapeCsv(v) {
  if (v === null || v === undefined) return '""';
  const s = String(v);
  if (s.includes('"') || s.includes(',') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
  return '"' + s + '"';
}

/** Header line for client CSV (with BOM). Use for streaming write. */
export function getClientCsvHeaderLine() {
  return '\uFEFF' + HEADERS.join(',') + '\n';
}

/** Single CSV row for one client record. Append after header for streaming. */
export function clientRecordToCsvRow(clientRecord) {
  return HEADERS.map((h) => escapeCsv(clientRecord[h])).join(',') + '\n';
}

export function exportClientCsv(clientRecords, outputPath) {
  if (!clientRecords || clientRecords.length === 0) { logger.warn('[Client export] No records for CSV'); return ''; }
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const headerLine = '\uFEFF' + HEADERS.join(',') + '\n';
  const rows = clientRecords.map((r) => HEADERS.map((h) => escapeCsv(r[h])).join(','));
  fs.writeFileSync(outputPath, headerLine + rows.join('\n') + '\n', 'utf-8');
  logger.info(`[Client export] CSV: ${outputPath} (${clientRecords.length} records)`);
  return outputPath;
}

export function exportClientNdjson(clientRecords, outputPath) {
  if (!clientRecords || clientRecords.length === 0) { logger.warn('[Client export] No records for NDJSON'); return ''; }
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const lines = clientRecords.map((r) => JSON.stringify(r)).join('\n');
  fs.writeFileSync(outputPath, lines + (lines ? '\n' : ''), 'utf-8');
  logger.info(`[Client export] NDJSON: ${outputPath} (${clientRecords.length} records)`);
  return outputPath;
}

/**
 * Prepare and export: dedupe, map to client shape, write CSV + NDJSON.
 * @param {Object[]} records - With uniqueId, businessName, etc.
 * @param {string} outputDir
 * @param {string} countryCode - PK, SA, etc.
 * @param {Object} options - { sampleSize: number | null, timestamp: string }
 */
export function prepareAndExportClient(records, outputDir, countryCode, options = {}) {
  if (!records || records.length === 0) { logger.warn('[Client export] No records'); return { csvPath: '', ndjsonPath: '', count: 0 }; }
  const deduped = dedupeClientRecords(records);
  const sampleSize = options.sampleSize ?? null;
  const toExport = sampleSize != null ? deduped.slice(0, sampleSize) : deduped;
  const clientRecords = toExport.map(toClientRecord);
  const timestamp = options.timestamp || new Date().toISOString().split('T')[0];
  const suffix = sampleSize != null ? `_sample_${sampleSize}` : '_full';
  const prefix = `businesses_${countryCode}_client${suffix}_${timestamp}`;
  const csvPath = path.join(outputDir, `${prefix}.csv`);
  const ndjsonPath = path.join(outputDir, `${prefix}.ndjson`);
  exportClientCsv(clientRecords, csvPath);
  exportClientNdjson(clientRecords, ndjsonPath);
  return { csvPath, ndjsonPath, count: clientRecords.length };
}

export default { toClientRecord, dedupeClientRecords, getClientCsvHeaderLine, clientRecordToCsvRow, exportClientCsv, exportClientNdjson, prepareAndExportClient };
