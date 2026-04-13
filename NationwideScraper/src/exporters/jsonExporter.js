/**
 * JSON export with metadata and data array.
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
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

/** Write final .json (metadata + data array) from an NDJSON file. Streams line-by-line. */
export async function finishJsonFromNdjson(ndjsonPath, jsonPath, totalRecords) {
  if (!fs.existsSync(ndjsonPath)) { logger.warn('[JSON] NDJSON file missing'); return ''; }
  const out = fs.createWriteStream(jsonPath, 'utf-8');
  const metadata = { exportDate: new Date().toISOString(), encoding: 'UTF-8' };
  if (totalRecords != null) metadata.statistics = { totalRecords };
  const metadataPretty = JSON.stringify(metadata, null, 4).replace(/\n/g, '\n  ');
  out.write(`{\n  "metadata": ${metadataPretty},\n  "data": [\n`);
  const rl = readline.createInterface({ input: fs.createReadStream(ndjsonPath, 'utf-8'), crlfDelay: Infinity });
  let count = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      if (count > 0) out.write(',\n');
      out.write(`    ${JSON.stringify(record)}`);
      count++;
    } catch (e) {}
  }
  out.write(`\n  ],\n  "totalRecords": ${count}\n}\n`);
  await new Promise((resolve, reject) => out.end((err) => err ? reject(err) : resolve()));
  logger.info(`[JSON] Wrote ${jsonPath} (${count} records from NDJSON)`);
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
