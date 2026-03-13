/**
 * Yell.co.uk (UK Yellow Pages) Scraper Module.
 *
 * Uses Crawlee's PlaywrightCrawler with Chromium to scrape
 * business listings from Yell.co.uk. Extracts:
 * - Business name, address, phone, website
 * - Social media links
 *
 * This is the SECONDARY data source for UK, used alongside
 * Google Maps to ensure comprehensive coverage.
 *
 * WARNING: Yell.co.uk uses Cloudflare protection which BLOCKS
 * automated scraping. This scraper includes detection for the
 * Cloudflare block page ("Sorry, you have been blocked") and
 * will gracefully return empty results if blocked.
 *
 * NOTE: Yell.co.uk does NOT provide GPS coordinates.
 * GPS data comes from the Google Maps source.
 */

import { PlaywrightCrawler } from 'crawlee';
import { chromium } from 'playwright';
import logger from '../utils/logger.js';
import { randomDelay } from '../utils/rateLimiter.js';
import { normalizeRecord } from '../utils/normalizer.js';

/**
 * Build Yell.co.uk search URL.
 *
 * @param {string} keyword - Search term
 * @param {string} location - City or area name
 * @param {number} [page=1] - Page number
 * @returns {string} Yell search URL
 */
function buildSearchUrl(keyword, location, page = 1) {
  const encodedKeyword = encodeURIComponent(keyword);
  const encodedLocation = encodeURIComponent(location);
  // Yell uses a clean URL pattern for search
  return (
    `https://www.yell.com/ucs/UcsSearchAction.do` +
    `?keywords=${encodedKeyword}` +
    `&location=${encodedLocation}` +
    `&pageNum=${page}`
  );
}

/**
 * Extract a single business record from a Yell listing card.
 *
 * @param {import('playwright').Page} page - Playwright page
 * @param {import('playwright').ElementHandle} card - Listing card element
 * @param {string} category - Business category name
 * @returns {Promise<Object|null>} Business record or null
 */
async function extractListingCard(page, card, category) {
  try {
    // Extract business name
    const businessName = await card
      .$eval(
        'h2.businessCapsule--name a, .businessCapsule--name',
        (el) => el.textContent?.trim(),
      )
      .catch(() => '');

    if (!businessName) return null;

    // Extract full address
    const address = await card
      .$eval(
        '.businessCapsule--address, address',
        (el) => el.textContent?.trim(),
      )
      .catch(() => '');

    // Parse address into components
    const addressParts = parseYellAddress(address);

    // Extract phone number
    const phone = await card
      .$eval(
        '.businessCapsule--phone a, ' +
          '.businessCapsule--telephone a',
        (el) => el.textContent?.trim(),
      )
      .catch(() => '');

    // Extract website URL
    const website = await card
      .$eval(
        'a.businessCapsule--ctaItem[href*="website"], ' +
          'a[data-tracking="website"]',
        (el) => el.href,
      )
      .catch(() => '');

    // Extract social media links from the card
    const facebook = await card
      .$eval(
        'a[href*="facebook.com"]',
        (el) => el.href,
      )
      .catch(() => '');

    const instagram = await card
      .$eval(
        'a[href*="instagram.com"]',
        (el) => el.href,
      )
      .catch(() => '');

    const tiktok = await card
      .$eval(
        'a[href*="tiktok.com"]',
        (el) => el.href,
      )
      .catch(() => '');

    // Extract the Yell listing URL (can be used to
    // visit the detail page for more info)
    const listingUrl = await card
      .$eval(
        'h2.businessCapsule--name a',
        (el) => el.href,
      )
      .catch(() => '');

    const record = {
      businessName,
      street: addressParts.street,
      city: addressParts.city,
      zipCode: addressParts.zipCode,
      state: addressParts.state,
      phone,
      website,
      googleMapsLink: '', // Will be merged from Google Maps data
      latitude: null,     // Will be merged from Google Maps data
      longitude: null,    // Will be merged from Google Maps data
      openingHours: '',   // Will attempt to get from detail page
      facebook,
      instagram,
      tiktok,
      category,
      country: 'UK',
      source: 'Yell.co.uk',
      _yellUrl: listingUrl, // Internal: for detail page crawl
    };

    return normalizeRecord(record);
  } catch (error) {
    logger.error(
      `Error extracting Yell listing: ${error.message}`,
    );
    return null;
  }
}

/**
 * Parse a Yell.co.uk address into components.
 * Yell format: "Street, Area, City PostCode"
 *
 * @param {string} address - Raw address from Yell
 * @returns {{ street: string, city: string, zipCode: string, state: string }}
 */
function parseYellAddress(address) {
  const result = {
    street: '',
    city: '',
    zipCode: '',
    state: '',
  };

  if (!address) return result;

  // UK postcode pattern
  const postcodeRegex = /([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})/i;
  const postcodeMatch = address.match(postcodeRegex);

  if (postcodeMatch) {
    result.zipCode = postcodeMatch[1].trim();
  }

  // Remove postcode from address for further parsing
  const withoutPostcode = address
    .replace(postcodeRegex, '')
    .trim();

  const parts = withoutPostcode
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 3) {
    result.street = parts[0];
    result.state = parts[parts.length - 2];
    result.city = parts[parts.length - 1];
  } else if (parts.length === 2) {
    result.street = parts[0];
    result.city = parts[1];
  } else if (parts.length === 1) {
    result.city = parts[0];
  }

  return result;
}

/**
 * Visit a Yell detail page to extract additional info:
 * opening hours, social media links, website.
 *
 * @param {import('playwright').Page} page - Playwright page
 * @param {string} detailUrl - Yell listing detail URL
 * @returns {Promise<Object>} Additional details
 */
async function scrapeDetailPage(page, detailUrl) {
  const details = {
    openingHours: '',
    facebook: '',
    instagram: '',
    tiktok: '',
    website: '',
  };

  try {
    await page.goto(detailUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await randomDelay(1500, 3000);

    // Extract opening hours
    details.openingHours = await page
      .$eval(
        '.openingHours--wrapper, .businessCapsule--openingHours',
        (el) => el.textContent?.trim(),
      )
      .catch(() => '');

    // Extract social media links
    const allLinks = await page.$$eval(
      'a[href]',
      (anchors) =>
        anchors.map((a) => a.href).filter(Boolean),
    );

    for (const link of allLinks) {
      const lower = link.toLowerCase();
      if (
        lower.includes('facebook.com') &&
        !details.facebook
      ) {
        details.facebook = link;
      }
      if (
        lower.includes('instagram.com') &&
        !details.instagram
      ) {
        details.instagram = link;
      }
      if (
        lower.includes('tiktok.com') &&
        !details.tiktok
      ) {
        details.tiktok = link;
      }
    }

    // Extract website from detail page
    details.website = await page
      .$eval(
        'a[data-tracking="website"], ' +
          'a.businessCapsule--callToAction[href*="http"]',
        (el) => el.href,
      )
      .catch(() => '');
  } catch (error) {
    logger.debug(
      `Could not scrape detail page: ${detailUrl}`,
    );
  }

  return details;
}

/**
 * Scrape Yell.co.uk for business listings.
 *
 * @param {Object} options
 * @param {Array<{name: string, keywords: string[]}>} options.categories
 * @param {string[]} options.locations - City/area names
 * @param {boolean} [options.isSample=false] - Limit results for sample
 * @param {number} [options.maxConcurrency=3] - Concurrent pages
 * @returns {Promise<Object[]>} Array of business records
 */
export async function scrapeYellUk({
  categories,
  locations,
  isSample = false,
  maxConcurrency = 3,
  onRecord = null,
}) {
  const allRecords = [];
  const seenNames = new Set();

  logger.info(
    `[Yell.co.uk] Starting scrape | ` +
      `${categories.length} categories | ` +
      `${locations.length} locations`,
  );

  // Build search request list
  const searchRequests = [];

  for (const category of categories) {
    for (const keyword of category.keywords) {
      for (const location of locations) {
        searchRequests.push({
          url: buildSearchUrl(keyword, location),
          userData: {
            keyword,
            location,
            categoryName: category.name,
            currentPage: 1,
          },
        });

        if (isSample) break;
      }
      if (isSample) break;
    }
  }

  logger.info(
    `[Yell.co.uk] Total search URLs: ${searchRequests.length}`,
  );

  const crawler = new PlaywrightCrawler({
    launchContext: {
      launcher: chromium,
      launchOptions: {
        headless: process.env.HEADLESS !== 'false',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-extensions',
          '--disable-background-networking',
          '--no-first-run',
        ],
      },
    },
    maxConcurrency: Math.min(maxConcurrency, 2),
    navigationTimeoutSecs: 60,
    requestHandlerTimeoutSecs: 180,
    maxRequestRetries: 3,
    keepAlive: false,

    preNavigationHooks: [],

    requestHandler: async ({
      page,
      request,
      log,
    }) => {
      const { keyword, location, categoryName, currentPage } =
        request.userData;

      log.info(
        `[Yell] "${keyword}" in ${location} - Page ${currentPage}`,
      );

      // --- CLOUDFLARE BLOCK DETECTION ---
      // Yell.co.uk uses Cloudflare which blocks automated browsers.
      // Check if we hit the block page.
      const pageContent = await page.content();
      if (
        pageContent.includes('you have been blocked') ||
        pageContent.includes('Cloudflare') ||
        pageContent.includes('Attention Required')
      ) {
        log.warning(
          `[Yell] BLOCKED by Cloudflare. Skipping "${keyword}" in ${location}. ` +
            `Yell.co.uk requires manual access or proxy rotation.`,
        );
        return; // Skip this request gracefully
      }

      // Handle cookie consent
      try {
        const cookieBtn = await page.$(
          '#consent_prompt_submit, ' +
            'button:has-text("Accept All"), ' +
            'button:has-text("Accept")',
        );
        if (cookieBtn) {
          await cookieBtn.click();
          await randomDelay(500, 1000);
        }
      } catch (e) {
        // No consent dialog
      }

      // Wait for listings to load
      await page
        .waitForSelector(
          '.businessCapsule, .organic, .searchResult',
          { timeout: 15000 },
        )
        .catch(() => {
          log.warning(
            `No Yell results for "${keyword}" in ${location}`,
          );
        });

      // Extract all listing cards on this page
      const cards = await page.$$(
        '.businessCapsule, .organic, .searchResult',
      );

      log.info(
        `Found ${cards.length} listings on page ${currentPage}`,
      );

      // In sample mode, take up to 3 listings per category
      // for fallback if some are skipped/invalid.
      const maxCards = isSample
        ? Math.min(3, cards.length)
        : cards.length;

      for (let i = 0; i < maxCards; i++) {
        const record = await extractListingCard(
          page,
          cards[i],
          categoryName,
        );

        if (record && record.businessName) {
          const dedupKey =
            `${record.businessName.toLowerCase()}|${record.city.toLowerCase()}`;

          if (!seenNames.has(dedupKey)) {
            seenNames.add(dedupKey);

            // Optionally visit detail page for extra data
            if (record._yellUrl) {
              try {
                const details = await scrapeDetailPage(
                  page,
                  record._yellUrl,
                );

                // Merge additional details
                if (details.openingHours) {
                  record.openingHours = details.openingHours;
                }
                if (details.facebook && !record.facebook) {
                  record.facebook = details.facebook;
                }
                if (details.instagram && !record.instagram) {
                  record.instagram = details.instagram;
                }
                if (details.tiktok && !record.tiktok) {
                  record.tiktok = details.tiktok;
                }
                if (details.website && !record.website) {
                  record.website = details.website;
                }

                // Navigate back to search results
                await page.goBack({
                  waitUntil: 'domcontentloaded',
                }).catch(() => {});
                await randomDelay(1000, 2000);
              } catch (e) {
                logger.debug(
                  'Could not visit Yell detail page',
                );
              }
            }

            delete record._yellUrl;
            allRecords.push(record);
            if (onRecord) onRecord(record);
            log.info(
              `  [${allRecords.length}] ${record.businessName}`,
            );
          }
        }
      }

      // Pagination: go to next page if not in sample mode
      if (!isSample && currentPage < 50) {
        const nextPageBtn = await page.$(
          'a.pagination--next, a[rel="next"]',
        );

        if (nextPageBtn) {
          const nextUrl = await nextPageBtn.evaluate(
            (el) => el.href,
          );
          if (nextUrl) {
            await crawler.addRequests([
              {
                url: nextUrl,
                userData: {
                  keyword,
                  location,
                  categoryName,
                  currentPage: currentPage + 1,
                },
              },
            ]);
          }
        }
      }

      await randomDelay(2000, 4000);
    },

    failedRequestHandler: async ({ request, log }) => {
      log.error(
        `[Yell] Request failed: ${request.url}`,
      );
    },
  });

  await crawler.run(searchRequests);

  logger.info(
    `[Yell.co.uk] Scrape complete. Total records: ${allRecords.length}`,
  );

  return allRecords;
}

export default { scrapeYellUk };
