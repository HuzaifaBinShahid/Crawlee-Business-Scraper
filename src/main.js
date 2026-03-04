import fs from 'fs';
import path from 'path';
import yargs from 'yargs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { hideBin } from 'yargs/helpers';

import logger from './utils/logger.js';
import KEYWORDS from './config/keywords.js';
import { scrapeYellUk } from './scrapers/yellUk.js';
import { getLocations } from './config/locations.js';
import { scrapeGoogleMaps } from './scrapers/googleMaps.js';
import { scrapePagesJaunes } from './scrapers/pagesJaunes.js';
import { SURNAMES_FOR_SEARCH } from './config/muslimSurnames.js';
import { deduplicateRecords } from './processors/deduplicator.js';
import { hasNegativeKeyword } from './config/negativeKeywords.js';
import { filterNegativeKeywords } from './processors/negativeFilter.js';
import {
  processRecords,
  processSingleRecord,
  getStatistics,
} from './processors/categorizer.js';
import { normalizeRecord } from './utils/normalizer.js';
import {
  resetCounters,
  getCounterState,
  setCounterState,
} from './utils/idGenerator.js';
import {
  loadProgress,
  saveProgress,
  searchKey as progressSearchKey,
} from './utils/progress.js';
import {
  exportToCsv,
  initIncrementalCsv,
  appendRecordToCsv,
} from './exporters/csvExporter.js';
import {
  exportToJson,
  initIncrementalJsonl,
  appendRecordToJsonl,
  readJsonlToRecords,
  writeRecordsToJsonl,
} from './exporters/jsonExporter.js';
import { prepareAndExportFrClient } from './exporters/frClientExport.js';
import { isValidUkRecord, filterToUkOnly } from './processors/ukRecordFilter.js';
import { filterToFrOnly, isValidFrRecord } from './processors/frRecordFilter.js';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const argv = yargs(hideBin(process.argv))
  .option('country', {
    alias: 'c',
    type: 'string',
    description: 'Country code to scrape (UK or FR)',
    choices: ['UK', 'FR'],
    demandOption: true,
  })
  .option('sample', {
    alias: 's',
    type: 'boolean',
    description: 'Run in sample mode (10-15 records)',
    default: false,
  })
  .option('source', {
    type: 'string',
    description: 'Scrape only a specific source',
    choices: ['google', 'yellow', 'all'],
    default: 'all',
  })
  .option('concurrency', {
    type: 'number',
    description: 'Max concurrent browser pages',
    default: parseInt(process.env.MAX_CONCURRENCY, 10) || 3,
  })
  .option('output', {
    alias: 'o',
    type: 'string',
    description: 'Output directory path',
    default: '',
  })
  .option('category', {
    alias: 'cat',
    type: 'string',
    description:
      'Scrape only this category (e.g. "Islamic Funeral Services"). ' +
      'If omitted, all categories are scraped.',
    default: '',
  })
  .option('resume', {
    type: 'boolean',
    description:
      'Resume from last run (skip already-done searches, append output). ' +
      'Use --no-resume or --fresh to start from scratch.',
    default: true,
  })
  .option('fresh', {
    type: 'boolean',
    description: 'Alias for --no-resume: ignore progress and overwrite output',
    default: false,
  })
  .option('fr-sample', {
    type: 'number',
    description:
      'FR only: export first N records as client sample (e.g. 200). ' +
      'Omit for full export.',
    default: null,
  })
  .help()
  .alias('help', 'h')
  .parse();

const PROFESSION_TERMS = {
  'Doctors': { UK: 'doctor', FR: 'medecin' },
  'Lawyers': { UK: 'lawyer', FR: 'avocat' },
  'Car Mechanics': { UK: 'car mechanic', FR: 'garage' },
  'Accountants': { UK: 'accountant', FR: 'comptable' },
  'Engineers': { UK: 'engineer', FR: 'ingenieur' },
};

function expandCategoriesWithSurnames(categories, country) {
  const termByCat = {};
  for (const [catName, terms] of Object.entries(PROFESSION_TERMS))
    if (terms[country]) termByCat[catName] = terms[country];

  return categories.map((cat) => {
    const term = termByCat && termByCat[cat.name];
    if (!term) return cat;

    const existingLower = new Set(
      cat.keywords.map((k) => k.toLowerCase().trim()),
    );
    const added = [];
    for (const surname of SURNAMES_FOR_SEARCH) {
      const phrase = `${term} ${surname}`.trim();
      if (!existingLower.has(phrase.toLowerCase())) {
        existingLower.add(phrase.toLowerCase());
        added.push(phrase);
      }
    }
    if (added.length === 0) return cat;
    return {
      ...cat,
      keywords: [...cat.keywords, ...added],
    };
  });
}

async function main() {
  const { country, sample, source, concurrency, output, category: categoryArg } =
    argv;
  const isSample = sample;

  const outputDir = output
    || (isSample
      ? path.join(__dirname, '..', 'data', 'samples')
      : path.join(__dirname, '..', 'data', 'output'));

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const startTime = Date.now();

  logger.info('='.repeat(60));
  logger.info(
    `GROCERY & COMMUNITY BUSINESS SCRAPER - v1.0.0`,
  );
  logger.info('='.repeat(60));
  logger.info(`Country:     ${country}`);
  logger.info(`Mode:        ${isSample ? 'SAMPLE' : 'FULL SCRAPE'}`);
  logger.info(`Source:      ${source}`);
  if (argv.category && argv.category.trim()) {
    logger.info(`Category:    ${argv.category.trim()}`);
  }
  if (
    (country === 'UK' || country === 'FR') &&
    !isSample &&
    argv.resume !== false &&
    !argv.fresh
  ) {
    logger.info(
      'Resume:      enabled (use --no-resume or --fresh to start over)',
    );
  }
  logger.info(`Concurrency: ${concurrency}`);
  logger.info(`Output:      ${outputDir}`);
  logger.info('='.repeat(60));
  logger.info('[Step 1/7] Loading configuration...');

  let categories = KEYWORDS[country]?.categories;
  if (!categories || categories.length === 0) {
    logger.error(
      `No keywords found for country: ${country}`,
    );
    process.exit(1);
  }

  if (categoryArg && categoryArg.trim()) {
    const wanted = categoryArg.trim();
    const normalized = wanted.toLowerCase();
    const matched = categories.filter(
      (c) => c.name.toLowerCase() === normalized,
    );
    if (matched.length === 0) {
      const names = categories.map((c) => c.name).join(', ');
      logger.error(
        `No category named "${wanted}" for country ${country}. ` +
        `Available: ${names}`,
      );
      process.exit(1);
    }
    categories = matched;
    logger.info(`  Category filter: "${categories[0].name}" (1 category)`);
  }

  categories = expandCategoriesWithSurnames(categories, country);

  const locations = getLocations(country, isSample);
  if (locations.length === 0) {
    logger.error(
      `No locations found for country: ${country}`,
    );
    process.exit(1);
  }

  logger.info(
    `  Categories: ${categories.length} | ` +
    `Total keywords: ${categories.reduce(
      (sum, c) => sum + c.keywords.length,
      0,
    )} | ` +
    `Locations: ${locations.length}`,
  );

  const useIncrementalWrite = (country === 'UK' || country === 'FR') && !isSample;
  const allowResume =
    useIncrementalWrite &&
    (country === 'UK' || country === 'FR') &&
    argv.resume !== false &&
    !argv.fresh;
  let processedRecords = [];
  let recordsForJson = processedRecords;
  let stats = null;
  let csvPath = '';
  let jsonPath = '';
  let jsonlPath = '';
  let progressPath = '';
  /** @type {{ runKey: string, csvPath: string, jsonlPath: string, completedSearches: string[], idGeneratorState: Object }} */
  let progressData = null;
  let isResume = false;

  if (useIncrementalWrite) {
    const timestamp = new Date().toISOString().split('T')[0];
    const filePrefix = `businesses_${country}_full_${timestamp}`;
    csvPath = path.join(outputDir, `${filePrefix}.csv`);
    jsonPath = path.join(outputDir, `${filePrefix}.json`);
    jsonlPath = path.join(outputDir, `${filePrefix}.jsonl`);
    progressPath = path.join(
      outputDir,
      `progress_${country}_full_${timestamp}.json`,
    );

    const existingProgress =
      allowResume && progressPath ? loadProgress(progressPath) : null;
    const csvExists = fs.existsSync(csvPath);
    const jsonlExists = fs.existsSync(jsonlPath);
    const outputFilesExist = csvExists && jsonlExists;

    if (existingProgress && outputFilesExist) {
      isResume = true;
      setCounterState(existingProgress.idGeneratorState || {});
      progressData = {
        runKey: existingProgress.runKey || `UK_full_${timestamp}`,
        csvPath,
        jsonlPath,
        completedSearches: [...(existingProgress.completedSearches || [])],
        idGeneratorState: getCounterState(),
      };
      logger.info(
        `[Resume] Continuing from previous run: ` +
        `${progressData.completedSearches.length} searches already done.`,
      );
      logger.info(
        '[Incremental] Appending to existing CSV and JSONL (same files).',
      );
    } else {
      if (country === 'FR') {
        const overwriteFiles = argv.fresh;
        if (!csvExists || overwriteFiles) {
          initIncrementalCsv(csvPath);
          logger.info(
            overwriteFiles && csvExists
              ? '[Incremental] FR: Overwrote CSV (--fresh).'
              : '[Incremental] FR: Created new CSV file.',
          );
        } else {
          logger.info(
            '[Incremental] FR: Appending to existing CSV (resume).',
          );
        }
        if (!jsonlExists || overwriteFiles) {
          initIncrementalJsonl(jsonlPath);
          logger.info(
            overwriteFiles && jsonlExists
              ? '[Incremental] FR: Overwrote JSONL (--fresh).'
              : '[Incremental] FR: Created new JSONL file.',
          );
        } else {
          logger.info(
            '[Incremental] FR: Appending to existing JSONL (resume).',
          );
        }
        const existingProgressFR =
          allowResume && progressPath ? loadProgress(progressPath) : null;
        if (
          existingProgressFR &&
          (csvExists || jsonlExists) &&
          !overwriteFiles
        ) {
          isResume = true;
          setCounterState(existingProgressFR.idGeneratorState || {});
          progressData = {
            runKey: existingProgressFR.runKey || `FR_full_${timestamp}`,
            csvPath,
            jsonlPath,
            completedSearches: [
              ...(existingProgressFR.completedSearches || []),
            ],
            idGeneratorState: getCounterState(),
          };
          logger.info(
            `[Resume] FR: Continuing from previous run: ` +
              `${progressData.completedSearches.length} searches already done.`,
          );
        } else {
          if (!existingProgressFR || overwriteFiles) resetCounters();
          progressData = {
            runKey: `FR_full_${timestamp}`,
            csvPath,
            jsonlPath,
            completedSearches: existingProgressFR?.completedSearches ?? [],
            idGeneratorState: getCounterState(),
          };
        }
      } else {
      const overwriteFiles = argv.fresh;
      if (!csvExists || overwriteFiles) {
        initIncrementalCsv(csvPath);
        logger.info(
          overwriteFiles && csvExists
            ? '[Incremental] Overwrote CSV (--fresh).'
            : '[Incremental] Created new CSV file.',
        );
      } else {
        logger.info('[Incremental] Appending to existing CSV (no overwrite).');
      }
      if (!jsonlExists || overwriteFiles) {
        initIncrementalJsonl(jsonlPath);
        logger.info(
          overwriteFiles && jsonlExists
            ? '[Incremental] Overwrote JSONL (--fresh).'
            : '[Incremental] Created new JSONL file.',
        );
      } else {
        logger.info('[Incremental] Appending to existing JSONL (no overwrite).');
      }
      if (existingProgress && (csvExists || jsonlExists) && !overwriteFiles) {
        isResume = true;
        setCounterState(existingProgress.idGeneratorState || {});
        progressData = {
          runKey: existingProgress.runKey || `UK_full_${timestamp}`,
          csvPath,
          jsonlPath,
          completedSearches: [...(existingProgress.completedSearches || [])],
          idGeneratorState: getCounterState(),
        };
      } else {
        if (!existingProgress || overwriteFiles) resetCounters();
        progressData = {
          runKey: `UK_full_${timestamp}`,
          csvPath,
          jsonlPath,
          completedSearches: existingProgress?.completedSearches ?? [],
          idGeneratorState: getCounterState(),
        };
      }
      }
    }
  }

  const seenKeys = new Set();
  if (useIncrementalWrite && jsonlPath && fs.existsSync(jsonlPath)) {
    try {
      const existing = readJsonlToRecords(jsonlPath);
      for (const r of existing) {
        const key =
          `${(r.businessName || '').toLowerCase()}|${(r.city || '').toLowerCase()}`;
        seenKeys.add(key);
      }
      if (seenKeys.size > 0) {
        logger.info(
          `[Incremental] Loaded ${seenKeys.size} existing record keys (will skip duplicates).`,
        );
      }
    } catch (e) {
      logger.warn('[Incremental] Could not load existing JSONL for dedup: ' + e.message);
    }
  }

  function handleIncrementalRecord(rawRecord) {
    const normalized = normalizeRecord(rawRecord);
    const key =
      `${(normalized.businessName || '').toLowerCase()}|${(normalized.city || '').toLowerCase()}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    if (hasNegativeKeyword(normalized.businessName)) return;
    const final = processSingleRecord(normalized);
    if (final.country === 'UK' && !isValidUkRecord(final)) {
      return;
    }
    if (final.country === 'FR' && !isValidFrRecord(final)) {
      return;
    }
    processedRecords.push(final);
    appendRecordToCsv(final, csvPath);
    appendRecordToJsonl(final, jsonlPath);
  }

  function handleSearchComplete(userData) {
    if (!progressData || !progressPath) return;
    const key = progressSearchKey(userData);
    progressData.completedSearches.push(key);
    progressData.idGeneratorState = getCounterState();
    saveProgress(progressPath, progressData);
  }
  let googleMapsRecords = [];

  if (source === 'all' || source === 'google') {
    logger.info(
      '[Step 2/7] Scraping Google Maps (primary source)...',
    );

    try {
      googleMapsRecords = await scrapeGoogleMaps({
        country,
        categories,
        locations,
        isSample,
        maxConcurrency: concurrency,
        onRecord: useIncrementalWrite ? handleIncrementalRecord : null,
        completedSearches: progressData?.completedSearches ?? [],
        onSearchComplete:
          useIncrementalWrite && progressPath
            ? handleSearchComplete
            : null,
      });

      logger.info(
        `  Google Maps records: ${googleMapsRecords.length}`,
      );
    } catch (error) {
      logger.error(
        `Google Maps scraper error: ${error.message}`,
      );
      logger.error(error.stack);
    }
  } else {
    logger.info(
      '[Step 2/7] Skipping Google Maps (source filter)',
    );
  }

  let yellowPagesRecords = [];

  if ((source === 'all' || source === 'yellow') && !isSample) {
    logger.info(
      '[Step 3/7] Scraping Yellow Pages (secondary source)...',
    );

    try {
      if (country === 'UK') {
        logger.warn(
          '  NOTE: Yell.co.uk uses Cloudflare protection. ' +
          'If blocked, results from Yell will be 0. ' +
          'Google Maps is the primary UK source.',
        );
        yellowPagesRecords = await scrapeYellUk({
          categories,
          locations,
          isSample,
          maxConcurrency: concurrency,
          onRecord: useIncrementalWrite ? handleIncrementalRecord : null,
        });
      } else if (country === 'FR') {
        yellowPagesRecords = await scrapePagesJaunes({
          categories,
          locations,
          isSample,
          maxConcurrency: concurrency,
          onRecord: useIncrementalWrite ? handleIncrementalRecord : null,
        });
      }

      logger.info(
        `  Yellow Pages records: ${yellowPagesRecords.length}`,
      );

      if (yellowPagesRecords.length === 0 && country === 'UK') {
        logger.warn(
          '  Yell.co.uk returned 0 records (likely Cloudflare blocked). ' +
          'Continuing with Google Maps data only.',
        );
      }
    } catch (error) {
      logger.error(
        `Yellow Pages scraper error: ${error.message}`,
      );
      logger.error(error.stack);
      logger.warn(
        '  Continuing pipeline with data from other sources.',
      );
    }
  } else {
    logger.info(
      isSample
        ? '[Step 3/7] Skipping Yellow Pages (sample mode - Google Maps only)'
        : '[Step 3/7] Skipping Yellow Pages (source filter)',
    );
  }

  if (useIncrementalWrite) {
    logger.info('[Step 7/7] Writing final JSON...');
    recordsForJson = processedRecords;
    if (jsonlPath && fs.existsSync(jsonlPath)) {
      const fromJsonl = readJsonlToRecords(jsonlPath);
      if (fromJsonl.length > 0) {
        const dedupeKey = (r) =>
          `${(r.businessName || '').toLowerCase()}|${(r.city || '').toLowerCase()}`;
        const seen = new Set();
        const merged = [];
        for (const r of fromJsonl) {
          const k = dedupeKey(r);
          if (!seen.has(k)) {
            seen.add(k);
            merged.push(r);
          }
        }
        for (const r of processedRecords) {
          const k = dedupeKey(r);
          if (!seen.has(k)) {
            seen.add(k);
            merged.push(r);
          }
        }
        recordsForJson = merged;
        logger.info(
          `  Merged ${fromJsonl.length} from file + ${processedRecords.length} this run = ${recordsForJson.length} total`,
        );
      }
    }
    for (const r of recordsForJson) {
      if (
        r.probabilityOfMuslimOwnership === '' ||
        r.probabilityOfMuslimOwnership == null
      ) {
        r.probabilityOfMuslimOwnership = 'Low';
      }
    }
    if (country === 'UK') {
      recordsForJson = filterToUkOnly(recordsForJson, 'UK export');
      if (recordsForJson.length === 0) {
        logger.warn(
          'No records to export after UK filter. Check your network and selectors.',
        );
        process.exit(0);
      }
      exportToCsv(recordsForJson, csvPath);
      writeRecordsToJsonl(recordsForJson, jsonlPath);
      stats = getStatistics(recordsForJson);
      exportToJson(recordsForJson, jsonPath, stats);
    } else {
      // FR: CSV/JSONL already written incrementally; just write final JSON + client export
      if (recordsForJson.length === 0) {
        logger.warn(
          'No records to export. Check your network and selectors.',
        );
        process.exit(0);
      }
      stats = getStatistics(recordsForJson);
      exportToJson(recordsForJson, jsonPath, stats);
      const timestamp = new Date().toISOString().split('T')[0];
      const frSample =
        argv.frSample != null ? parseInt(argv.frSample, 10) : null;
      const frResult = prepareAndExportFrClient(recordsForJson, outputDir, {
        sampleSize: Number.isNaN(frSample) ? null : frSample,
        timestamp,
      });
      if (frResult.count > 0) {
        logger.info(
          `[FR client] Export: ${frResult.count} records → ` +
            `${frResult.csvPath} | ${frResult.ndjsonPath}`,
        );
      }
    }
  }

  if (!useIncrementalWrite) {
    logger.info('[Step 4/7] Merging records from all sources...');

    const allRawRecords = [
      ...googleMapsRecords,
      ...yellowPagesRecords,
    ];

    logger.info(
      `  Total raw records: ${allRawRecords.length}`,
    );

    if (allRawRecords.length === 0) {
      logger.warn(
        'No records were scraped. Check your network and selectors.',
      );
      logger.info('Exiting.');
      process.exit(0);
    }

    logger.info(
      '[Step 5/7] Deduplicating records across sources...',
    );

    const uniqueRecords = deduplicateRecords(allRawRecords);

    logger.info(
      `  After dedup: ${uniqueRecords.length} unique records ` +
      `(removed ${allRawRecords.length - uniqueRecords.length} duplicates)`,
    );

    const afterNegativeFilter = filterNegativeKeywords(uniqueRecords);
    logger.info(
      `  After negative filter: ${afterNegativeFilter.length} records`,
    );

    if (afterNegativeFilter.length === 0) {
      logger.warn(
        'No records left after filtering. Exiting.',
      );
      process.exit(0);
    }

    logger.info(
      '[Step 6/7] Categorizing (Chain/Independent), Probability, and assigning IDs...',
    );

    processedRecords = processRecords(afterNegativeFilter);
    stats = getStatistics(processedRecords);

    logger.info(`  Chains: ${stats.byType.Chain}`);
    logger.info(`  Independents: ${stats.byType.Independent}`);
    logger.info(`  With GPS: ${stats.withGps}`);
    logger.info(`  With phone: ${stats.withPhone}`);
    logger.info(`  With website: ${stats.withWebsite}`);
    logger.info(
      `  With social media: ${stats.withSocialMedia}`,
    );

    logger.info('[Step 7/7] Exporting data...');

    const timestamp = new Date().toISOString().split('T')[0];
    const mode = isSample ? 'sample' : 'full';
    const filePrefix = `businesses_${country}_${mode}_${timestamp}`;
    csvPath = path.join(outputDir, `${filePrefix}.csv`);
    jsonPath = path.join(outputDir, `${filePrefix}.json`);

    if (country === 'FR') {
      processedRecords = filterToFrOnly(processedRecords, 'FR standard export');
      if (processedRecords.length === 0) {
        logger.warn('No FR records left after FR filter. Exiting.');
        process.exit(0);
      }
      stats = getStatistics(processedRecords);
    }

    exportToCsv(processedRecords, csvPath);
    exportToJson(processedRecords, jsonPath, stats);

    if (country === 'FR') {
      const frSample = argv.frSample != null ? parseInt(argv.frSample, 10) : null;
      const frResult = prepareAndExportFrClient(processedRecords, outputDir, {
        sampleSize: Number.isNaN(frSample) ? null : frSample,
        timestamp,
      });
      if (frResult.count > 0) {
        logger.info(
          `[FR client] Export: ${frResult.count} records → ` +
          `${frResult.csvPath} | ${frResult.ndjsonPath}`,
        );
      }
    }
  }

  const finalRecordCount =
    useIncrementalWrite && recordsForJson
      ? recordsForJson.length
      : processedRecords.length;
  if (!stats) stats = getStatistics(processedRecords);
  if (useIncrementalWrite && finalRecordCount !== processedRecords.length) {
    stats = getStatistics(recordsForJson);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  logger.info('='.repeat(60));
  logger.info('SCRAPING COMPLETE');
  logger.info('='.repeat(60));
  logger.info(`Country:          ${country}`);
  logger.info(`Mode:             ${isSample ? 'SAMPLE' : 'FULL'}`);
  logger.info(`Total records:    ${finalRecordCount}`);
  logger.info(`Chains:           ${stats.byType.Chain}`);
  logger.info(`Independents:     ${stats.byType.Independent}`);
  logger.info(`Time elapsed:     ${elapsed}s`);
  logger.info(`CSV output:       ${csvPath}`);
  logger.info(`JSON output:      ${jsonPath}`);
  logger.info('='.repeat(60));

  logger.info('Category breakdown:');
  for (const [cat, count] of Object.entries(
    stats.byCategory,
  )) {
    logger.info(`  ${cat}: ${count}`);
  }

  logger.info('Source breakdown:');
  for (const [src, count] of Object.entries(
    stats.bySources,
  )) {
    logger.info(`  ${src}: ${count}`);
  }
}

main()
  .then(() => {
    logger.info('Process finished successfully.');
    process.exit(0);
  })
  .catch((error) => {
    logger.error(`Fatal error: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  });
