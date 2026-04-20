/**
 * Nationwide scraper CLI — Google Maps only, same client schema as France.
 * Usage: node src/main.js --country=PK [--sample] [--category="Health & Emergency"]
 */

// Let Crawlee use 70% of system RAM instead of the default 25% — on an 8GB laptop
// the default pretends only 2GB is available, which triggers false "memory overloaded" warnings.
// Must be set BEFORE crawlee is imported (via scrapers/googleMaps.js).
if (!process.env.CRAWLEE_AVAILABLE_MEMORY_RATIO) {
  process.env.CRAWLEE_AVAILABLE_MEMORY_RATIO = '0.7';
}

import fs from 'fs';
import path from 'path';
import readline from 'readline';
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
import { finishJsonFromNdjson } from './exporters/jsonExporter.js';
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
    description: 'Max concurrent browser pages (forced to 1 — multiple tabs are unstable)',
    default: 1,
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
  .option('nav-timeout', {
    type: 'number',
    description: 'Navigation timeout in seconds',
    default: 90,
  })
  .option('max-retries', {
    type: 'number',
    description: 'Max retries per failed request',
    default: 0,
  })
  .option('retry-file', {
    type: 'string',
    description: 'Path to JSON file with failed URLs to retry',
    default: '',
  })
  .help()
  .alias('help', 'h')
  .parse();

async function main() {
  const countryInput = (argv.country || '').trim();
  const isSample = argv.sample === true;
  const categoryArg = (argv.category || '').trim();
  const concurrency = 1; // FORCED — multi-tab Playwright + Google Maps leaks elementHandles

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

  const countrySlug = countryCode || countryInput.replace(/\s+/g, '_');
  const clientSuffix = isSample ? `_sample_50` : '_full';
  const clientPrefix = `businesses_${countrySlug}_client${clientSuffix}`;

  // Final output: ONLY these two files (CSV + JSON). NDJSON is a temporary streaming buffer,
  // deleted after the final JSON is written.
  const clientCsvPath = path.join(outputDir, `${clientPrefix}.csv`);
  const clientJsonPath = path.join(outputDir, `${clientPrefix}.json`);
  const clientNdjsonPath = path.join(outputDir, `${clientPrefix}.ndjson`);

  const clientCsvIsNew = !fs.existsSync(clientCsvPath);
  const clientCsv = fs.createWriteStream(clientCsvPath, { flags: 'a', encoding: 'utf-8' });
  const clientNdjson = fs.createWriteStream(clientNdjsonPath, { flags: 'a', encoding: 'utf-8' });

  if (clientCsvIsNew) clientCsv.write(getClientCsvHeaderLine());

  // Pre-load existing records into dedupe set to avoid duplicates across runs.
  // Prefer the JSON (final output from last complete run); fall back to NDJSON
  // (leftover from an interrupted run).
  const dedupeSet = new Set();
  async function loadDedupeFromFile(filePath, isNdjson) {
    try {
      if (isNdjson) {
        const rl = readline.createInterface({ input: fs.createReadStream(filePath, 'utf-8'), crlfDelay: Infinity });
        for await (const line of rl) {
          if (!line.trim()) continue;
          try {
            const r = JSON.parse(line);
            const key = getDedupeKey({ businessName: r.name, latitude: r.latitude ?? r.lat, longitude: r.longitude ?? r.lon });
            if (key) dedupeSet.add(key);
          } catch (e) {}
        }
      } else {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const arr = Array.isArray(parsed) ? parsed : parsed.data || [];
        for (const r of arr) {
          const key = getDedupeKey({ businessName: r.name, latitude: r.latitude ?? r.lat, longitude: r.longitude ?? r.lon });
          if (key) dedupeSet.add(key);
        }
      }
    } catch (e) {}
  }
  if (fs.existsSync(clientJsonPath)) {
    await loadDedupeFromFile(clientJsonPath, false);
    logger.info(`[Resume] Loaded ${dedupeSet.size} existing records from ${path.basename(clientJsonPath)}.`);
  } else if (fs.existsSync(clientNdjsonPath)) {
    await loadDedupeFromFile(clientNdjsonPath, true);
    logger.info(`[Resume] Loaded ${dedupeSet.size} existing records from interrupted NDJSON.`);
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
    const clientRecord = toClientRecord(record);
    clientCsv.write(clientRecordToCsvRow(clientRecord));
    clientNdjson.write(JSON.stringify(clientRecord) + '\n');
    writtenCount++;
  }

  const minDelay = Math.max(500, argv['min-delay'] || 2000);
  const maxDelay = Math.max(minDelay, argv['max-delay'] || 5000);
  const proxies = argv.proxy ? argv.proxy.split(',').map((s) => s.trim()).filter(Boolean) : [];

  // Skip records already in dedupeSet before extracting full details (saves time)
  function isDuplicate(name, latitude, longitude) {
    const key = getDedupeKey({ businessName: name, latitude, longitude });
    return key && dedupeSet.has(key);
  }

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
    isDuplicate,
    headless: argv.headless !== false,
    minDelay,
    maxDelay,
    proxies,
  });

  const closeStream = (stream) => new Promise((resolve, reject) => {
    stream.end((err) => (err ? reject(err) : resolve()));
  });
  await Promise.all([
    closeStream(clientCsv),
    closeStream(clientNdjson),
  ]);

  if (writtenCount > 0 || fs.existsSync(clientNdjsonPath)) {
    // Rebuild the final JSON from the full NDJSON (which contains prior-run records too).
    await finishJsonFromNdjson(clientNdjsonPath, clientJsonPath, null);
    // NDJSON was just a streaming buffer — the JSON is authoritative now.
    try { fs.unlinkSync(clientNdjsonPath); } catch (e) {}
  }

  if (writtenCount === 0 && dedupeSet.size === 0) {
    logger.warn('No records scraped. Exiting.');
    try { fs.unlinkSync(clientCsvPath); } catch (e) {}
    try { fs.unlinkSync(clientJsonPath); } catch (e) {}
    process.exit(0);
  }

  logger.info('='.repeat(60));
  logger.info('SCRAPING COMPLETE');
  logger.info('='.repeat(60));
  logger.info(`New records this run: ${writtenCount}`);
  logger.info(`Total unique records: ${dedupeSet.size}`);
  logger.info(`Client CSV:  ${clientCsvPath}`);
  logger.info(`Client JSON: ${clientJsonPath}`);
  logger.info('='.repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error(err.message);
    logger.error(err.stack);
    process.exit(1);
  });
