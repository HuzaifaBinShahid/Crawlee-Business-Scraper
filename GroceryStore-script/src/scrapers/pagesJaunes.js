/**
 * PagesJaunes.fr (French Yellow Pages) Scraper Module.
 *
 * Uses Crawlee's PlaywrightCrawler with Chromium to scrape
 * business listings from PagesJaunes.fr.
 *
 * Search: direct GET to /annuaire/chercherlespros?quoiqui=...&ou=...&page=...
 * Form equivalents: category in #quoiqui, location in #ou, submit #findId.
 *
 * VERIFIED SELECTORS (from live HTML):
 *   Results section:   section#listResults, ul.bi-list
 *   Listing cards:     ul.bi-list li.bi[id^="bi-"] (excludes ad blocks)
 *   Business name:     a.bi-denomination h3
 *   Address:           .bi-address a (text: street, postcode, city)
 *   Rating:            .bi-note .note_moyenne
 *   Review count:      .bi-rating (e.g. "(7 avis)")
 *   Phone:             .bi-fantomas .number-contact (after click "Afficher le N°")
 *   Website:           a.bi-website[href] or data-pjlb (base64)
 *   Detail page URL:   a.bi-denomination[href*="/pros/"] or data-pjlb
 *   Next page:        #pagination-next
 *   Cookie consent:   #didomi-notice-agree-button
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
 * @param {string} location - City or area name (ou), e.g. Paris, Lyon
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
 *
 * @param {import('playwright').Page} page - Playwright page
 * @param {import('playwright').ElementHandle} card - The <li.bi> element
 * @param {string} category - Business category name
 * @returns {Promise<Object|null>} Business record or null
 */
async function extractListingCard(page, card, category) {
  try {
    // ---- BUSINESS NAME ----
    const businessName = await card
      .$eval(
        'a.bi-denomination h3, .bi-denomination h3',
        (el) => el?.textContent?.trim(),
      )
      .catch(() => '');

    if (!businessName) return null;

    // ---- ADDRESS ----
    const rawAddress = await card
      .$eval(
        '.bi-address a',
        (el) => el?.textContent?.trim(),
      )
      .catch(() => '');

    const addressParts = parsePagesJaunesAddress(rawAddress);

    // ---- RATING ----
    let rating = null;
    const ratingText = await card
      .$eval(
        '.bi-note .note_moyenne, .bi-note h4 .note_moyenne',
        (el) => el?.textContent?.trim(),
      )
      .catch(() => '');
    if (ratingText) {
      const r = parseFloat(ratingText.replace(',', '.'));
      if (!Number.isNaN(r) && r >= 0 && r <= 5) rating = r;
    }

    // ---- REVIEW COUNT ----
    let reviewCount = null;
    const ratingLabel = await card
      .$eval(
        '.bi-rating',
        (el) => el?.textContent?.trim(),
      )
      .catch(() => '');
    if (ratingLabel) {
      const avisMatch = ratingLabel.match(
        /(?:\(?\s*)(\d[\d\s,]*)\s*avis/i,
      );
      if (avisMatch) {
        const n = parseInt(avisMatch[1].replace(/[\s,]/g, ''), 10);
        if (!Number.isNaN(n) && n >= 0) reviewCount = n;
      }
    }

    // ---- PHONE: not extracted (would require clicking "Afficher le N°") ----
    const phone = '';

    // ---- ACTIVITY (e.g. "boucheries, boucheries-charcuteries") ----
    const activity = await card
      .$eval(
        '.bi-activity-unit',
        (el) => el?.textContent?.trim(),
      )
      .catch(() => '');

    // ---- DESCRIPTION ----
    const description = await card
      .$eval(
        '.bi-description',
        (el) => el?.textContent?.trim(),
      )
      .catch(() => '');

    // ---- TAGS (e.g. ["boucherie halal", "rôtisserie"]) ----
    const tags = await card
      .$$eval(
        '.bi-tags-list .bi-tag',
        (nodes) => nodes.map((n) => n?.textContent?.trim()).filter(Boolean),
      )
      .catch(() => []);

    // ---- OPENING HOURS ----
    const openingHours = await card
      .$eval(
        '.bi-hours',
        (el) => el?.textContent?.trim(),
      )
      .catch(() => '');

    // ---- DETAIL PAGE URL ----
    let detailUrl = await card
      .$eval(
        'a.bi-denomination',
        (el) => {
          const href = el?.getAttribute?.('href')?.trim();
          if (href && href.includes('/pros/')) return el.href || '';
          const pjlb = el?.getAttribute?.('data-pjlb');
          if (pjlb) {
            try {
              const parsed = JSON.parse(pjlb);
              const url = parsed?.url;
              if (url) {
                const decoded = atob(url);
                if (decoded.startsWith('http')) return decoded;
                if (decoded.startsWith('/'))
                  return `https://www.pagesjaunes.fr${decoded}`;
              }
            } catch {}
          }
          return '';
        },
      )
      .catch(() => '');

    if (detailUrl && !detailUrl.startsWith('http')) {
      detailUrl = `https://www.pagesjaunes.fr${detailUrl}`;
    }

    // ---- WEBSITE (from card when present) ----
    let website = await card
      .$eval(
        'a.bi-website[href^="http"]',
        (el) => el?.href?.trim(),
      )
      .catch(() => '');
    if (!website) {
      website = await card
        .$eval(
          'a.bi-website[data-pjlb]',
          (el) => {
            const pjlb = el?.getAttribute?.('data-pjlb');
            if (!pjlb) return '';
            try {
              const parsed = JSON.parse(pjlb);
              const url = parsed?.url;
              if (!url) return '';
              const decoded = atob(url);
              if (decoded.startsWith('http')) return decoded;
              if (decoded.startsWith('/'))
                return `https://www.pagesjaunes.fr${decoded}`;
            } catch {}
            return '';
          },
        )
        .catch(() => '');
    }

    // ---- SOCIAL MEDIA ----
    const socialLinks = await extractSocialFromCard(card);

    const record = {
      businessName,
      street: addressParts.street,
      city: addressParts.city,
      zipCode: addressParts.zipCode,
      state: addressParts.state,
      phone,
      website: website || '',
      googleMapsLink: '',
      latitude: null,
      longitude: null,
      openingHours,
      rating,
      review_count: reviewCount,
      facebook: socialLinks.facebook,
      instagram: socialLinks.instagram,
      tiktok: socialLinks.tiktok,
      category,
      country: 'FR',
      source: 'PagesJaunes.fr',
      activity: activity || '',
      description: description || '',
      tags: Array.isArray(tags) ? tags : [],
      detailUrl: detailUrl || '',
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
        'a.bi-website[href^="http"], ' +
          'a[data-pjstats*="SITE_WEB"], ' +
          'a[data-pjstats*="WEBSITE"], ' +
          'a.pj-link[href*="http"][target="_blank"]',
        (el) => el?.href?.trim(),
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

      // Handle cookie/consent modals (Didomi or "Faites un choix" banner):
      // click accept so the list is visible, then wait for ul.bi-list.
      try {
        await randomDelay(1200, 2000);
        const acceptSelectors = [
          '#didomi-notice-agree-button',
          'button.button__acceptAll',
          'button.button__skip',
          '[aria-label*="Tout Accepter"]',
        ];
        let clicked = false;
        for (const sel of acceptSelectors) {
          const btn = await page.$(sel);
          if (btn) {
            await btn.click();
            clicked = true;
            break;
          }
        }
        if (!clicked) {
          const byText = await page
            .locator(
              'button:has-text("Tout Accepter"), ' +
                'button:has-text("Tout accepter"), ' +
                'button:has-text("Accepter & Fermer"), ' +
                'button:has-text("Accepter")',
            )
            .first()
            .click()
            .then(() => true)
            .catch(() => false);
          if (byText) clicked = true;
        }
        if (clicked) await randomDelay(800, 1500);
      } catch (e) {
        // No consent dialog or already closed
      }

      // Wait for the results list (ul.bi-list) to be visible after consent
      await page
        .waitForSelector('ul.bi-list', { state: 'visible', timeout: 25000 })
        .catch(() => null);
      await randomDelay(1000, 1800);

      // Wait for at least one listing card to appear
      await page
        .waitForSelector(
          'ul.bi-list li.bi[id^="bi-"]',
          { timeout: 15000 },
        )
        .catch(() => {
          log.warning(
            `No PagesJaunes results for "${keyword}" in ${location}`,
          );
        });

      await randomDelay(600, 1000);

      const allCards = await page.$$('ul.bi-list > li.bi');
      const cards = [];
      for (const el of allCards) {
        const id = await el.getAttribute('id').catch(() => '');
        if (id && /^bi-\d+$/.test(id)) cards.push(el);
      }

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
