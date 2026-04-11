/**
 * Nationwide scraper CLI — Google Maps only, same client schema as France.
 * Usage: node src/main.js --country=PK [--sample] [--category="Health & Emergency"]
 */

import fs from 'fs';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { fileURLToPath } from 'url';

import logger from './utils/logger.js';
import { getCategories } from './config/keywords.js';
import { getLocations } from './config/locations.js';
import { getCountryDisplayName, normalizeCountryCode } from './config/countryNames.js';
import { isWithinSampleRegion } from './config/sampleBounds.js';
import { scrapeGoogleMaps } from './scrapers/googleMaps.js';
import { getDedupeKey } from './processors/deduplicator.js';
import { generateId, resetCounters } from './utils/idGenerator.js';
import { getCsvHeaderLine, recordToCsvRow } from './exporters/csvExporter.js';
import { recordToExportShape, finishJsonFromNdjson } from './exporters/jsonExporter.js';
import { getClientCsvHeaderLine, clientRecordToCsvRow, toClientRecord } from './exporters/clientExport.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const argv = yargs(hideBin(process.argv))
  .option('country', {
    alias: 'c',
    type: 'string',
    description: 'Country: PK, SA, Pakistan, Saudi Arabia, or any name (e.g. India)',
    demandOption: true,
  })
  .option('sample', {
    alias: 's',
    type: 'boolean',
    description: 'Sample mode: fetch 50 records total (~10 per category), then stop',
    default: false,
  })
  .option('category', {
    alias: 'cat',
    type: 'string',
    description: 'Scrape only this category (e.g. "Health & Emergency"). Omit for all.',
    default: '',
  })
  .option('output', {
    alias: 'o',
    type: 'string',
    description: 'Output directory (default: data/samples for sample, data/output for full)',
    default: '',
  })
  .option('city', {
    type: 'string',
    description: 'Scrape only this city (e.g. "Lahore"). Omit for all cities.',
    default: '',
  })
  .option('headless', {
    type: 'boolean',
    description: 'Run browser in headless mode. Use --no-headless to see the browser.',
    default: true,
  })
  .option('concurrency', {
    type: 'number',
    description: 'Max concurrent browser pages',
    default: 2,
  })
  .option('min-delay', {
    type: 'number',
    description: 'Minimum delay between requests in ms',
    default: 2000,
  })
  .option('max-delay', {
    type: 'number',
    description: 'Maximum delay between requests in ms',
    default: 5000,
  })
  .option('proxy', {
    type: 'string',
    description: 'Comma-separated list of proxy URLs (e.g. http://user:pass@host:port)',
    default: '',
  })
  .help()
  .alias('help', 'h')
  .parse();

async function main() {
  const countryInput = (argv.country || '').trim();
  const isSample = argv.sample === true;
  const categoryArg = (argv.category || '').trim();
  const concurrency = Math.max(1, Math.min(argv.concurrency || 2, 3));

  const outputDir = argv.output
    || path.join(__dirname, '..', 'data', isSample ? 'samples' : 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const cityArg = (argv.city || '').trim();
  const countryCode = normalizeCountryCode(countryInput);
  const countryDisplayName = getCountryDisplayName(countryInput);
  let categories = getCategories(countryCode || countryInput);
  let locations = getLocations(countryCode || countryInput, isSample);

  if (cityArg) {
    const wanted = cityArg.toLowerCase();
    const matched = locations.filter((loc) => loc.toLowerCase() === wanted);
    if (matched.length === 0) {
      logger.error(`No city "${cityArg}" found. Available: ${locations.join(', ')}`);
      process.exit(1);
    }
    locations = matched;
  }

  if (categoryArg) {
    const wanted = categoryArg.toLowerCase();
    const matched = categories.filter((c) => c.name.toLowerCase() === wanted);
    if (matched.length === 0) {
      logger.error(`No category "${categoryArg}". Available: ${categories.map((c) => c.name).join(', ')}`);
      process.exit(1);
    }
    categories = matched;
  }

  if (!locations.length) {
    logger.error('No locations for this country. Add cities in config/locations.js or use a known country (PK, SA).');
    process.exit(1);
  }

  logger.info('='.repeat(60));
  logger.info('NATIONWIDE SCRAPER — Google Maps only');
  logger.info('='.repeat(60));
  logger.info(`Country:     ${countryInput} (code: ${countryCode || countryInput})`);
  logger.info(`Mode:        ${isSample ? 'SAMPLE (50 records)' : 'FULL'}`);
  logger.info(`Categories:  ${categories.length} | Locations: ${locations.length}`);
  logger.info(`Output:      ${outputDir}`);
  logger.info('='.repeat(60));

  resetCounters();

  const timestamp = new Date().toISOString().split('T')[0];
  const mode = isSample ? 'sample' : 'full';
  const countrySlug = countryCode || countryInput.replace(/\s+/g, '_');
  const filePrefix = `businesses_${countrySlug}_${mode}_${timestamp}`;
  const clientSuffix = isSample ? `_sample_50` : '_full';
  const clientPrefix = `businesses_${countrySlug}_client${clientSuffix}_${timestamp}`;

  const csvPath = path.join(outputDir, `${filePrefix}.csv`);
  const ndjsonPath = path.join(outputDir, `${filePrefix}.ndjson`);
  const jsonPath = path.join(outputDir, `${filePrefix}.json`);
  const clientCsvPath = path.join(outputDir, `${clientPrefix}.csv`);
  const clientNdjsonPath = path.join(outputDir, `${clientPrefix}.ndjson`);

  const internalCsvIsNew = !fs.existsSync(csvPath);
  const internalNdjsonIsNew = !fs.existsSync(ndjsonPath);
  const clientCsvIsNew = !fs.existsSync(clientCsvPath);
  const internalCsv = fs.createWriteStream(csvPath, { flags: 'a', encoding: 'utf-8' });
  const internalNdjson = fs.createWriteStream(ndjsonPath, { flags: 'a', encoding: 'utf-8' });
  const clientCsv = fs.createWriteStream(clientCsvPath, { flags: 'a', encoding: 'utf-8' });
  const clientNdjson = fs.createWriteStream(clientNdjsonPath, { flags: 'a', encoding: 'utf-8' });

  if (internalCsvIsNew) internalCsv.write(getCsvHeaderLine());
  if (clientCsvIsNew) clientCsv.write(getClientCsvHeaderLine());

  // Pre-load existing records into dedupe sets to avoid duplicates across runs
  const dedupeSet = new Set();
  const clientDedupeSet = new Set();
  if (!internalNdjsonIsNew) {
    try {
      const existing = fs.readFileSync(ndjsonPath, 'utf-8').split('\n').filter((l) => l.trim());
      for (const line of existing) {
        try {
          const r = JSON.parse(line);
          const key = getDedupeKey(r);
          if (key) { dedupeSet.add(key); clientDedupeSet.add(key); }
        } catch (e) {}
      }
      logger.info(`[Resume] Loaded ${dedupeSet.size} existing records from previous run.`);
    } catch (e) {}
  }
  let writtenCount = 0;

  function onRecord(record) {
    if (isSample) {
      const code = (countryCode || countryInput || '').toString();
      if (!isWithinSampleRegion(record, code)) return;
    }
    const key = getDedupeKey(record);
    if (dedupeSet.has(key)) return;
    dedupeSet.add(key);
    record.uniqueId = generateId(record.country || countryCode || countryInput, record.city || '');
    internalCsv.write(recordToCsvRow(record));
    internalNdjson.write(JSON.stringify(recordToExportShape(record)) + '\n');
    if (!clientDedupeSet.has(key)) {
      clientDedupeSet.add(key);
      const clientRecord = toClientRecord(record);
      clientCsv.write(clientRecordToCsvRow(clientRecord));
      clientNdjson.write(JSON.stringify(clientRecord) + '\n');
    }
    writtenCount++;
  }

  const minDelay = Math.max(500, argv['min-delay'] || 2000);
  const maxDelay = Math.max(minDelay, argv['max-delay'] || 5000);
  const proxies = argv.proxy ? argv.proxy.split(',').map((s) => s.trim()).filter(Boolean) : [];

  const records = await scrapeGoogleMaps({
    country: countryCode || countryInput,
    countryDisplayName,
    categories,
    locations,
    isSample,
    sampleTargetTotal: isSample ? 50 : 0,
    samplePerCategoryTarget: 10,
    maxConcurrency: concurrency,
    onRecord,
    headless: argv.headless !== false,
    minDelay,
    maxDelay,
    proxies,
  });

  const closeStream = (stream) => new Promise((resolve, reject) => {
    stream.end((err) => (err ? reject(err) : resolve()));
  });
  await Promise.all([
    closeStream(internalCsv),
    closeStream(internalNdjson),
    closeStream(clientCsv),
    closeStream(clientNdjson),
  ]);

  if (writtenCount > 0) {
    finishJsonFromNdjson(ndjsonPath, jsonPath, writtenCount);
  }

  if (!records.length && writtenCount === 0) {
    logger.warn('No records scraped. Exiting.');
    try { fs.unlinkSync(csvPath); } catch (e) {}
    try { fs.unlinkSync(ndjsonPath); } catch (e) {}
    try { fs.unlinkSync(clientCsvPath); } catch (e) {}
    try { fs.unlinkSync(clientNdjsonPath); } catch (e) {}
    process.exit(0);
  }

  logger.info('='.repeat(60));
  logger.info('SCRAPING COMPLETE');
  logger.info('='.repeat(60));
  logger.info(`Total records saved: ${writtenCount}`);
  logger.info(`Internal CSV:  ${csvPath}`);
  logger.info(`Internal JSON: ${jsonPath}`);
  logger.info(`Client CSV:    ${clientCsvPath}`);
  logger.info(`Client NDJSON: ${clientNdjsonPath}`);
  logger.info('='.repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error(err.message);
    logger.error(err.stack);
    process.exit(1);
  });
