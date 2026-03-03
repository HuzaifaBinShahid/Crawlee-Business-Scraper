/**
 * PagesJaunes.fr (French Yellow Pages) Scraper Module.
 *
 * Uses Crawlee's PlaywrightCrawler with Chromium to scrape
 * business listings from PagesJaunes.fr.
 *
 * VERIFIED SELECTORS (from live HTML as of Feb 2026):
 *   Listing cards:    li.bi.bi-generic
 *   Business name:    a.bi-denomination h3
 *   Address:          .bi-address a (text contains street+postcode+city)
 *   Phone:            .bi-fantomas .number-contact (hidden until "Afficher le N" clicked)
 *   Opening hours:    .bi-hours span
 *   Detail page URL:  a.bi-denomination[href]
 *   Next page:        #pagination-next
 *   Cookie consent:   #didomi-notice-agree-button
 *
 * NOTE: Phone numbers are behind a click-to-reveal button.
 *       We click "Afficher le N" to expose them in .bi-fantomas.
 */

import { PlaywrightCrawler } from 'crawlee';
import { chromium } from 'playwright';
import logger from '../utils/logger.js';
import { randomDelay } from '../utils/rateLimiter.js';
import { normalizeRecord } from '../utils/normalizer.js';

/**
 * Build PagesJaunes.fr search URL.
 *
 * @param {string} keyword - Search term (quoiqui)
 * @param {string} location - City or area name (ou)
 * @param {number} [page=1] - Page number
 * @returns {string} PagesJaunes search URL
 */
function buildSearchUrl(keyword, location, page = 1) {
  const encodedKeyword = encodeURIComponent(keyword);
  const encodedLocation = encodeURIComponent(location);
  return (
    `https://www.pagesjaunes.fr/annuaire/chercherlespros` +
    `?quoiqui=${encodedKeyword}` +
    `&ou=${encodedLocation}` +
    `&page=${page}`
  );
}

/**
 * Extract a single business record from a PagesJaunes <li.bi> card.
 * Based on verified live HTML structure.
 *
 * @param {import('playwright').Page} page - Playwright page
 * @param {import('playwright').ElementHandle} card - The <li.bi> element
 * @param {string} category - Business category name
 * @returns {Promise<Object|null>} Business record or null
 */
async function extractListingCard(page, card, category) {
  try {
    // ---- BUSINESS NAME ----
    // Selector: a.bi-denomination > h3
    const businessName = await card
      .$eval(
        'a.bi-denomination h3',
        (el) => el.textContent?.trim(),
      )
      .catch(() => '');

    if (!businessName) return null;

    // ---- ADDRESS ----
    // Selector: .bi-address a (contains full text like
    //   "209 avenue Versailles 75016 Paris")
    const rawAddress = await card
      .$eval(
        '.bi-address a',
        (el) => el.textContent?.trim(),
      )
      .catch(() => '');

    const addressParts = parsePagesJaunesAddress(rawAddress);

    // ---- PHONE NUMBER ----
    // Phone is hidden in .bi-fantomas .number-contact
    // First, click the "Afficher le N" button to reveal it
    let phone = '';
    try {
      const phoneBtn = await card.$(
        'button.btn_tel',
      );
      if (phoneBtn) {
        await phoneBtn.click();
        await randomDelay(300, 600);
      }

      // Now extract from the revealed .bi-fantomas div
      // The text is like "Tél : 09 84 41 65 73"
      const phoneRaw = await card
        .$eval(
          '.bi-fantomas .number-contact',
          (el) => el.textContent?.trim(),
        )
        .catch(() => '');

      if (phoneRaw) {
        // Extract phone number: digits, spaces, and +
        const phoneMatch = phoneRaw.match(
          /(?:Tél\s*:\s*)?(\+?[\d\s]{8,})/,
        );
        phone = phoneMatch
          ? phoneMatch[1].trim()
          : '';
      }
    } catch (e) {
      // Phone not available
    }

    // ---- OPENING HOURS ----
    // Selector: .bi-hours span (e.g. "Fermé maintenant")
    const openingHours = await card
      .$eval(
        '.bi-hours',
        (el) => el.textContent?.trim(),
      )
      .catch(() => '');

    // ---- DETAIL PAGE URL ----
    // Selector: a.bi-denomination[href]
    // href is like "/pros/54398069" (relative)
    let detailUrl = await card
      .$eval(
        'a.bi-denomination',
        (el) => el.href,
      )
      .catch(() => '');

    // Make absolute if relative
    if (detailUrl && !detailUrl.startsWith('http')) {
      detailUrl = `https://www.pagesjaunes.fr${detailUrl}`;
    }

    // ---- SOCIAL MEDIA (from listing card links) ----
    const socialLinks = await extractSocialFromCard(card);

    // ---- WEBSITE (not typically on listing card, comes from detail page) ----
    const website = '';

    const record = {
      businessName,
      street: addressParts.street,
      city: addressParts.city,
      zipCode: addressParts.zipCode,
      state: addressParts.state,
      phone,
      website,
      googleMapsLink: '',
      latitude: null,
      longitude: null,
      openingHours,
      facebook: socialLinks.facebook,
      instagram: socialLinks.instagram,
      tiktok: socialLinks.tiktok,
      category,
      country: 'FR',
      source: 'PagesJaunes.fr',
      _detailUrl: detailUrl,
    };

    return normalizeRecord(record);
  } catch (error) {
    logger.error(
      `Error extracting PagesJaunes listing: ${error.message}`,
    );
    return null;
  }
}

/**
 * Extract social media links from a PagesJaunes card.
 *
 * @param {import('playwright').ElementHandle} card - Listing card
 * @returns {Promise<{facebook: string, instagram: string, tiktok: string}>}
 */
async function extractSocialFromCard(card) {
  const result = { facebook: '', instagram: '', tiktok: '' };

  try {
    const links = await card.$$eval(
      'a[href]',
      (anchors) =>
        anchors.map((a) => a.href).filter(Boolean),
    );

    for (const link of links) {
      const lower = link.toLowerCase();
      if (lower.includes('facebook.com') && !result.facebook) {
        result.facebook = link;
      }
      if (lower.includes('instagram.com') && !result.instagram) {
        result.instagram = link;
      }
      if (lower.includes('tiktok.com') && !result.tiktok) {
        result.tiktok = link;
      }
    }
  } catch (e) {
    // No social links found
  }

  return result;
}

/**
 * Parse a PagesJaunes address into components.
 *
 * Real examples from live HTML:
 *   "209 avenue Versailles 75016  Paris"
 *   "36 rue Montholon 75009  Paris"
 *   "19 avenue Corentin Cariou 75019  Paris"
 *   "144 rue Avron 75020  Paris"
 *
 * Pattern: {street} {5-digit-postcode} {city}
 * Sometimes has extra text like "Voir le plan"
 *
 * @param {string} address - Raw address text
 * @returns {{ street: string, city: string, zipCode: string, state: string }}
 */
function parsePagesJaunesAddress(address) {
  const result = {
    street: '',
    city: '',
    zipCode: '',
    state: '',
  };

  if (!address) return result;

  // Clean up common extra text
  let cleaned = address
    .replace(/Voir le plan/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // French postcode: exactly 5 digits
  const postcodeRegex = /\b(\d{5})\b/;
  const postcodeMatch = cleaned.match(postcodeRegex);

  if (postcodeMatch) {
    result.zipCode = postcodeMatch[1];

    // Street is everything BEFORE the postcode
    const postcodeIndex = cleaned.indexOf(postcodeMatch[1]);
    result.street = cleaned
      .substring(0, postcodeIndex)
      .trim();

    // City is everything AFTER the postcode
    result.city = cleaned
      .substring(postcodeIndex + 5)
      .trim();
  } else {
    // No postcode found, treat entire text as street
    result.street = cleaned;
  }

  return result;
}

/**
 * Visit a PagesJaunes detail page (/pros/{id}) for extra data:
 * opening hours, website, social media links.
 *
 * @param {import('playwright').Page} page - Playwright page
 * @param {string} detailUrl - Full detail page URL
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

    // Opening hours from detail page
    details.openingHours = await page
      .$eval(
        '#zoneHoraires, .bloc-horaires, ' +
          '.horaire-ouverture',
        (el) => el.textContent?.trim(),
      )
      .catch(() => '');

    // Website link from detail page
    details.website = await page
      .$eval(
        'a[data-pjstats*="SITE_WEB"], ' +
          'a[data-pjstats*="WEBSITE"], ' +
          'a.pj-link[href*="http"][target="_blank"]',
        (el) => el.href,
      )
      .catch(() => '');

    // Extract all links for social media
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
  } catch (error) {
    logger.debug(
      `Could not scrape PagesJaunes detail page: ${detailUrl}`,
    );
  }

  return details;
}

/**
 * Scrape PagesJaunes.fr for business listings.
 *
 * @param {Object} options
 * @param {Array<{name: string, keywords: string[]}>} options.categories
 * @param {string[]} options.locations - City/area names
 * @param {boolean} [options.isSample=false] - Limit results
 * @param {number} [options.maxConcurrency=3] - Concurrent pages
 * @returns {Promise<Object[]>} Array of business records
 */
export async function scrapePagesJaunes({
  categories,
  locations,
  isSample = false,
  maxConcurrency = 3,
  onRecord = null,
}) {
  const allRecords = [];
  const seenNames = new Set();

  logger.info(
    `[PagesJaunes] Starting scrape | ` +
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
    `[PagesJaunes] Total search URLs: ${searchRequests.length}`,
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

    requestHandler: async ({ page, request, log }) => {
      const { keyword, location, categoryName, currentPage } =
        request.userData;

      log.info(
        `[PJ] "${keyword}" in ${location} - Page ${currentPage}`,
      );

      // Handle Didomi cookie consent (RGPD)
      try {
        const cookieBtn = await page.$(
          '#didomi-notice-agree-button, ' +
            'button:has-text("Accepter & Fermer"), ' +
            'button:has-text("Tout accepter")',
        );
        if (cookieBtn) {
          await cookieBtn.click();
          await randomDelay(500, 1000);
        }
      } catch (e) {
        // No consent dialog
      }

      // Wait for the listing cards to load
      // Real selector: li.bi.bi-generic inside ul.bi-list
      await page
        .waitForSelector(
          'ul.bi-list li.bi, li.bi-generic',
          { timeout: 15000 },
        )
        .catch(() => {
          log.warning(
            `No PagesJaunes results for "${keyword}" in ${location}`,
          );
        });

      // Extract all listing cards (li.bi inside section.results)
      const cards = await page.$$(
        'ul.bi-list > li.bi',
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

            // Visit detail page for extra data (website, social, hours)
            if (record._detailUrl && !isSample) {
              try {
                const details = await scrapeDetailPage(
                  page,
                  record._detailUrl,
                );

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
                  'Could not visit PagesJaunes detail page',
                );
              }
            }

            // Remove internal field
            delete record._detailUrl;
            allRecords.push(record);
            if (onRecord) onRecord(record);
            log.info(
              `  [${allRecords.length}] ${record.businessName} - ${record.city}`,
            );
          }
        }
      }

      // ---- PAGINATION ----
      // Real selector: a#pagination-next
      if (!isSample && currentPage < 100) {
        const hasNextPage = await page.$(
          'a#pagination-next, a.next',
        );

        if (hasNextPage) {
          const nextPageUrl = buildSearchUrl(
            keyword,
            location,
            currentPage + 1,
          );
          await crawler.addRequests([
            {
              url: nextPageUrl,
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

      await randomDelay(2000, 4000);
    },

    failedRequestHandler: async ({ request, log }) => {
      log.error(
        `[PagesJaunes] Request failed: ${request.url}`,
      );
    },
  });

  await crawler.run(searchRequests);

  logger.info(
    `[PagesJaunes] Scrape complete. Total records: ${allRecords.length}`,
  );

  return allRecords;
}

export default { scrapePagesJaunes };
