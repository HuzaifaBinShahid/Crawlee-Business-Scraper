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
import { filterToSampleRegion } from './config/sampleBounds.js';
import { scrapeGoogleMaps } from './scrapers/googleMaps.js';
import { deduplicateRecords } from './processors/deduplicator.js';
import { generateId, resetCounters } from './utils/idGenerator.js';
import { exportToCsv } from './exporters/csvExporter.js';
import { exportToJson } from './exporters/jsonExporter.js';
import { prepareAndExportClient } from './exporters/clientExport.js';

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
  .option('concurrency', {
    type: 'number',
    description: 'Max concurrent browser pages',
    default: 2,
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

  const countryCode = normalizeCountryCode(countryInput);
  const countryDisplayName = getCountryDisplayName(countryInput);
  let categories = getCategories(countryCode || countryInput);
  let locations = getLocations(countryCode || countryInput, isSample);

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

  const records = await scrapeGoogleMaps({
    country: countryCode || countryInput,
    countryDisplayName,
    categories,
    locations,
    isSample,
    sampleTargetTotal: isSample ? 50 : 0,
    samplePerCategoryTarget: 10,
    maxConcurrency: concurrency,
  });

  if (!records.length) {
    logger.warn('No records scraped. Exiting.');
    process.exit(0);
  }

  const regionFiltered = filterToSampleRegion(records, countryCode || countryInput, isSample);
  const deduped = deduplicateRecords(regionFiltered);
  for (const r of deduped) {
    r.uniqueId = generateId(r.country || countryCode || countryInput, r.city || '');
  }

  const timestamp = new Date().toISOString().split('T')[0];
  const mode = isSample ? 'sample' : 'full';
  const filePrefix = `businesses_${countryCode || countryInput.replace(/\s+/g, '_')}_${mode}_${timestamp}`;
  const csvPath = path.join(outputDir, `${filePrefix}.csv`);
  const jsonPath = path.join(outputDir, `${filePrefix}.json`);

  exportToCsv(deduped, csvPath);
  exportToJson(deduped, jsonPath, { totalRecords: deduped.length });

  const clientResult = prepareAndExportClient(deduped, outputDir, countryCode || countryInput.replace(/\s+/g, '_'), {
    sampleSize: isSample ? 50 : null,
    timestamp,
  });
  if (clientResult.count > 0) {
    logger.info(`[Client] ${clientResult.count} records → ${clientResult.csvPath} | ${clientResult.ndjsonPath}`);
  }

  logger.info('='.repeat(60));
  logger.info('SCRAPING COMPLETE');
  logger.info('='.repeat(60));
  logger.info(`Total records: ${deduped.length}`);
  logger.info(`CSV:  ${csvPath}`);
  logger.info(`JSON: ${jsonPath}`);
  logger.info('='.repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error(err.message);
    logger.error(err.stack);
    process.exit(1);
  });
