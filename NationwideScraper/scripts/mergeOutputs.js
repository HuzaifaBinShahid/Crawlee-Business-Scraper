/**
 * Merge all NDJSON output files in data/output/ into one deduped CSV + JSON per schema.
 *
 * Produces:
 *   data/output/merged/businesses_<country>_merged.json
 *   data/output/merged/businesses_<country>_merged.csv
 *   data/output/merged/businesses_<country>_client_merged.json
 *   data/output/merged/businesses_<country>_client_merged.csv
 *
 * Dedupe key: lowercase businessName + coords rounded to 4 decimals.
 * Streams line-by-line so it handles huge files on low-memory machines.
 *
 * Usage: node scripts/mergeOutputs.js [--country=SA] [--dir=<path>]
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2).reduce((acc, a) => {
  const m = a.match(/^--([^=]+)=(.*)$/);
  if (m) acc[m[1]] = m[2];
  else if (a.startsWith('--')) acc[a.slice(2)] = true;
  return acc;
}, {});

const country = (args.country || 'SA').toUpperCase();
const outputDir = args.dir || path.join(__dirname, '..', 'data', 'output');
const mergedDir = path.join(outputDir, 'merged');
if (!fs.existsSync(mergedDir)) fs.mkdirSync(mergedDir, { recursive: true });

const ROUND = 4;
function coordKey(lat, lon) {
  const nLat = typeof lat === 'number' ? lat : parseFloat(lat);
  const nLon = typeof lon === 'number' ? lon : parseFloat(lon);
  if (nLat == null || nLon == null || Number.isNaN(nLat) || Number.isNaN(nLon)) return '';
  const rnd = (v) => Math.round(v * 10 ** ROUND) / 10 ** ROUND;
  return `${rnd(nLat)}|${rnd(nLon)}`;
}

// --- Internal schema (nested address/contact/location) ---
const INTERNAL_COLUMNS = [
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

function internalDedupeKey(rec) {
  const name = (rec.businessName || '').toLowerCase().trim();
  const lat = rec.location?.latitude ?? rec.latitude;
  const lon = rec.location?.longitude ?? rec.longitude;
  return `${name}|${coordKey(lat, lon)}`;
}

function flattenInternal(rec) {
  return {
    uniqueId: rec.uniqueId || '',
    businessName: rec.businessName || '',
    category: rec.category || '',
    street: rec.address?.street ?? rec.street ?? '',
    city: rec.address?.city ?? rec.city ?? '',
    zipCode: rec.address?.zipCode ?? rec.zipCode ?? '',
    state: rec.address?.state ?? rec.state ?? '',
    country: rec.address?.country ?? rec.country ?? '',
    phone: rec.contact?.phone ?? rec.phone ?? '',
    website: rec.contact?.website ?? rec.website ?? '',
    googleMapsLink: rec.location?.googleMapsLink ?? rec.googleMapsLink ?? '',
    latitude: rec.location?.latitude ?? rec.latitude ?? null,
    longitude: rec.location?.longitude ?? rec.longitude ?? null,
    openingHours: rec.openingHours || '',
    rating: rec.rating ?? null,
    review_count: rec.review_count ?? null,
    source: rec.dataSource || rec.source || '',
  };
}

// --- Client schema (flat) ---
const CLIENT_COLUMNS = [
  'external_id', 'name', 'category_raw', 'lat', 'lon', 'address', 'city',
  'postcode', 'country_code', 'phone', 'website', 'source', 'source_url',
  'opening_hours', 'rating', 'review_count', 'scraped_at',
];

function clientDedupeKey(rec) {
  const name = (rec.name || '').toLowerCase().trim();
  return `${name}|${coordKey(rec.lat, rec.lon)}`;
}

// --- CSV escape ---
function esc(v) {
  if (v === null || v === undefined) return '""';
  const s = String(v);
  if (s.includes('"') || s.includes(',') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
  return '"' + s + '"';
}

async function* readNdjsonLines(filePath) {
  const rl = readline.createInterface({ input: fs.createReadStream(filePath, 'utf-8'), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try { yield JSON.parse(line); } catch (e) { /* skip bad lines */ }
  }
}

async function mergeFiles({ files, dedupeKeyFn, transformFn, csvHeaderCols, csvRowFn, outCsv, outJson, label }) {
  const csvStream = fs.createWriteStream(outCsv, 'utf-8');
  const jsonStream = fs.createWriteStream(outJson, 'utf-8');
  csvStream.write('\uFEFF' + csvHeaderCols.map(esc).join(',') + '\n');
  jsonStream.write(`{\n  "metadata": {\n    "exportDate": ${JSON.stringify(new Date().toISOString())},\n    "source": "merged",\n    "sourceFiles": ${JSON.stringify(files.map((f) => path.basename(f)))}\n  },\n  "data": [\n`);

  const seen = new Set();
  let kept = 0;
  let dupes = 0;
  let totalRead = 0;

  for (const file of files) {
    let fileKept = 0, fileDupes = 0;
    for await (const raw of readNdjsonLines(file)) {
      totalRead++;
      const transformed = transformFn ? transformFn(raw) : raw;
      const key = dedupeKeyFn(transformed);
      if (!key || !key.split('|')[0]) continue; // skip records with no name
      if (seen.has(key)) { dupes++; fileDupes++; continue; }
      seen.add(key);
      if (kept > 0) jsonStream.write(',\n');
      jsonStream.write('    ' + JSON.stringify(transformed));
      csvStream.write(csvRowFn(transformed));
      kept++;
      fileKept++;
    }
    console.log(`  ${path.basename(file)}: kept ${fileKept}, dupes ${fileDupes}`);
  }

  jsonStream.write('\n  ],\n  "totalRecords": ' + kept + '\n}\n');
  await Promise.all([
    new Promise((r, j) => csvStream.end((e) => e ? j(e) : r())),
    new Promise((r, j) => jsonStream.end((e) => e ? j(e) : r())),
  ]);
  console.log(`[${label}] Total read: ${totalRead} | Unique: ${kept} | Duplicates removed: ${dupes}`);
  console.log(`[${label}] CSV:  ${outCsv}`);
  console.log(`[${label}] JSON: ${outJson}`);
}

async function main() {
  const all = fs.readdirSync(outputDir).filter((f) => f.endsWith('.ndjson'));
  const internalFiles = all
    .filter((f) => f.startsWith(`businesses_${country}_full_`) && !f.includes('_client_'))
    .map((f) => path.join(outputDir, f))
    .sort();
  const clientFiles = all
    .filter((f) => f.startsWith(`businesses_${country}_client_full_`))
    .map((f) => path.join(outputDir, f))
    .sort();

  console.log(`\n=== Merging ${country} outputs from ${outputDir} ===`);
  console.log(`Found ${internalFiles.length} internal NDJSON file(s), ${clientFiles.length} client NDJSON file(s)\n`);

  if (internalFiles.length > 0) {
    console.log('--- Internal schema ---');
    await mergeFiles({
      files: internalFiles,
      dedupeKeyFn: internalDedupeKey,
      transformFn: flattenInternal,
      csvHeaderCols: INTERNAL_COLUMNS.map((c) => c.header),
      csvRowFn: (r) => INTERNAL_COLUMNS.map((c) => {
        let v = r[c.key];
        if (v === null || v === undefined) v = '';
        return esc(typeof v === 'number' ? String(v) : v);
      }).join(',') + '\n',
      outCsv: path.join(mergedDir, `businesses_${country}_merged.csv`),
      outJson: path.join(mergedDir, `businesses_${country}_merged.json`),
      label: 'Internal',
    });
    console.log('');
  }

  if (clientFiles.length > 0) {
    console.log('--- Client schema ---');
    await mergeFiles({
      files: clientFiles,
      dedupeKeyFn: clientDedupeKey,
      transformFn: null,
      csvHeaderCols: CLIENT_COLUMNS,
      csvRowFn: (r) => CLIENT_COLUMNS.map((k) => esc(r[k])).join(',') + '\n',
      outCsv: path.join(mergedDir, `businesses_${country}_client_merged.csv`),
      outJson: path.join(mergedDir, `businesses_${country}_client_merged.json`),
      label: 'Client',
    });
  }

  console.log('\n=== Done ===');
}

main().catch((err) => { console.error(err); process.exit(1); });
