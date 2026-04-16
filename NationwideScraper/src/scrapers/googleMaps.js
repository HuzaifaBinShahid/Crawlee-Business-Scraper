/**
 * Google Maps scraper — same selectors as GroceryStore-script.
 * Builds query as "keyword in location, countryName". Sample mode: stop at 50 records, ~10 per category.
 */

import { PlaywrightCrawler, ProxyConfiguration } from 'crawlee';
import { chromium } from 'playwright';
import logger from '../utils/logger.js';
import { randomDelay } from '../utils/rateLimiter.js';
import { checkPause } from '../utils/pauseCheck.js';
import { emitProgress } from '../utils/progress.js';
import { normalizeRecord } from '../processors/normalizer.js';
import { getSearchUrl } from '../config/sources.js';

function buildSearchUrl(keyword, location, countryDisplayName) {
  const baseUrl = getSearchUrl(countryDisplayName);
  const query = countryDisplayName
    ? `${keyword} in ${location}, ${countryDisplayName}`
    : `${keyword} in ${location}`;
  return `${baseUrl}${encodeURIComponent(query)}`;
}

function extractCoordsFromUrl(url) {
  try {
    const dataMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (dataMatch) return { latitude: parseFloat(dataMatch[1]), longitude: parseFloat(dataMatch[2]) };
    const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) return { latitude: parseFloat(atMatch[1]), longitude: parseFloat(atMatch[2]) };
  } catch (e) {}
  return { latitude: null, longitude: null };
}

async function waitForFeedLoaderGone(page, maxMs = 8000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const loader = await page.$('div[role="feed"] div.uj8Yqe');
    if (!loader) return false;
    await page.waitForTimeout(400);
  }
  return true; // loader still there after maxMs
}

async function isEndOfListReached(page) {
  const endOfResults = await page.$('span.HlvSq, p.fontBodyMedium > span > span');
  if (!endOfResults) return false;
  const endText = await endOfResults.textContent().catch(() => '');
  if (!endText) return false;
  return endText.includes('end of list')
    || endText.includes("You've reached the end")
    || endText.includes('Fin de la liste')
    || endText.includes('No results');
}

/**
 * Scroll the results feed until we truly reach the end.
 * Strategy: keep scrolling while the skeleton-loader (div.uj8Yqe) is present —
 * that's Google Maps' "more results are loading" indicator. Stop only when:
 *   - End-of-list text appears, OR
 *   - Loader is gone AND card count hasn't grown for 3 consecutive checks.
 */
async function scrollFullList(page, { isSample = false, log = null } = {}) {
  const scrollable = await page.$('div[role="feed"]');
  if (!scrollable) return 0;
  let previousCardCount = 0;
  let noGrowthCount = 0;
  const NO_GROWTH_THRESHOLD = isSample ? 2 : 3;
  const MAX_ROUNDS = isSample ? 10 : 200;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    await scrollable.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await randomDelay(1500, 2500);
    // Wait up to 8s for loader to vanish — if it persists, there are more results incoming.
    const loaderStillShowing = await waitForFeedLoaderGone(page, 8000);

    if (await isEndOfListReached(page)) {
      if (log) log.info(`  Scroll: reached end of list after ${round + 1} rounds`);
      break;
    }

    const currentCount = (await page.$$('div[role="feed"] div[role="article"]')).length;

    if (loaderStillShowing) {
      // Loader is persistent — more loading, keep scrolling and don't count this as stagnant.
      noGrowthCount = 0;
      previousCardCount = currentCount;
      continue;
    }
    if (currentCount === previousCardCount) {
      noGrowthCount++;
      if (noGrowthCount >= NO_GROWTH_THRESHOLD) {
        if (log) log.info(`  Scroll: no growth for ${NO_GROWTH_THRESHOLD} rounds at ${currentCount} cards — stopping`);
        break;
      }
    } else {
      noGrowthCount = 0;
      previousCardCount = currentCount;
    }
  }
  return (await page.$$('div[role="feed"] div[role="article"]')).length;
}

async function extractSocialLinks(page) {
  const socialLinks = { facebook: '', instagram: '', tiktok: '' };
  try {
    const panelSelector = 'div.m6QErb.DxyBCb.kA9KIf.dS8AEf, div[aria-label^="Information for"]';
    const links = await page.$$eval(`${panelSelector} a[href]`, (anchors) => {
      const seen = new Set();
      return anchors.map((a) => (a.href || '').trim()).filter((href) => href && !seen.has(href) && (seen.add(href), true));
    }).catch(() => []);
    for (const link of links) {
      const lower = link.toLowerCase();
      if (lower.includes('/sharer/') || lower.includes('share.php') || lower.includes('dialog/')) continue;
      if (lower.includes('facebook.com') && !socialLinks.facebook) socialLinks.facebook = link;
      if (lower.includes('instagram.com') && !socialLinks.instagram) socialLinks.instagram = link;
      if (lower.includes('tiktok.com') && !socialLinks.tiktok) socialLinks.tiktok = link;
    }
  } catch (e) {}
  return socialLinks;
}

async function extractListingCardData(card) {
  const data = { businessName: '', phone: '', coords: { latitude: null, longitude: null }, googleMapsLink: '', isSponsored: false, rating: null, reviewCount: null };
  try {
    data.isSponsored = await card.$eval('span.jHLihd', (el) => el.textContent?.trim().toLowerCase() === 'sponsored').catch(() => false);
    data.businessName = await card.$eval('div.qBF1Pd.fontHeadlineSmall', (el) => el.textContent?.trim()).catch(() => '');
    data.phone = await card.$eval('span.UsdlK', (el) => el.textContent?.trim()).catch(() => '');
    const ratingAndReview = await card.$eval('span.ZkP5Je[aria-label]', (el) => {
      const aria = (el.getAttribute('aria-label') || '').trim();
      const m = aria.match(/([\d.,]+)\s*stars?\s*(\d[\d\s,]*)\s*(?:reviews?|avis)/i);
      if (m) {
        const r = parseFloat(m[1].replace(',', '.'));
        const n = parseInt((m[2] || '').replace(/[\s,]/g, ''), 10);
        return { rating: !Number.isNaN(r) && r >= 0 && r <= 5 ? r : null, reviewCount: !Number.isNaN(n) && n >= 0 ? n : null };
      }
      return { rating: null, reviewCount: null };
    }).catch(() => null);
    if (ratingAndReview) {
      if (ratingAndReview.rating != null) data.rating = ratingAndReview.rating;
      if (ratingAndReview.reviewCount != null) data.reviewCount = ratingAndReview.reviewCount;
    }
    if (data.rating == null || data.reviewCount == null) {
      const fromSpans = await card.$$eval('span.MW4etd, span.UY7F9', (spans) => {
        let rating = null, reviewCount = null;
        for (const el of spans) {
          const t = (el.textContent || '').trim();
          if (el.classList.contains('MW4etd')) { const r = parseFloat(t.replace(',', '.')); if (!Number.isNaN(r) && r >= 0 && r <= 5) rating = r; }
          else if (el.classList.contains('UY7F9')) { const paren = t.match(/\(([\d\s,]+)\)/); if (paren) { const n = parseInt(paren[1].replace(/[\s,]/g, ''), 10); if (!Number.isNaN(n) && n >= 0) reviewCount = n; } }
        }
        return { rating, reviewCount };
      }).catch(() => null);
      if (fromSpans) {
        if (data.rating == null && fromSpans.rating != null) data.rating = fromSpans.rating;
        if (data.reviewCount == null && fromSpans.reviewCount != null) data.reviewCount = fromSpans.reviewCount;
      }
    }
    const href = await card.$eval('a.hfpxzc', (el) => el.href).catch(() => '');
    if (href) {
      data.googleMapsLink = href.split('?')[0];
      data.coords = extractCoordsFromUrl(href);
    }
  } catch (e) {}
  return data;
}

function parseAddress(address) {
  const result = { street: '', city: '', zipCode: '', state: '' };
  if (!address) return result;
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  result.street = parts[0] || '';
  result.city = parts.length > 1 ? parts[1] : '';
  result.zipCode = parts.length > 2 ? parts[2] : '';
  result.state = parts.length > 3 ? parts[3] : '';
  return result;
}

async function extractBusinessDetails(page, listing, categoryName, countryCode, cardData, searchLocation) {
  try {
    await listing.click();
    await randomDelay(2000, 4000); // Detail page load — keep fixed for reliability
    await page.waitForSelector('h1.DUwDvf, h1.fontHeadlineLarge', { timeout: 10000 }).catch(() => null);
    const businessName = await page.$eval('h1.DUwDvf, h1.fontHeadlineLarge', (el) => el.textContent?.trim()).catch(() => cardData.businessName || '');
    if (!businessName) return null;
    const address = await page.$eval('button[data-item-id="address"] div.fontBodyMedium, [data-item-id="address"] .Io6YTe', (el) => el.textContent?.trim()).catch(() => '');
    const addressParts = parseAddress(address);
    if (!addressParts.city && searchLocation) addressParts.city = searchLocation;
    const phone = await page.$eval('button[data-item-id^="phone"] div.fontBodyMedium, [data-tooltip="Copy phone number"] .Io6YTe', (el) => el.textContent?.trim()).catch(() => cardData.phone || '');
    const websiteHref = await page.$eval('a[data-item-id="authority"]', (el) => el.href).catch(() => '');
    const openingHours = await page.$eval('[data-item-id="oh"] .fontBodyMedium, div.t39EBf.GUrTXd, table.eK4R0e', (el) => el.textContent?.trim()).catch(() => '');
    let rating = null, reviewCount = null;
    try {
      const overviewBlock = await page.$$eval('div.fontBodyMedium.dmRWX, div.F7nice', (containers) => {
        let best = { rating: null, reviewCount: null };
        for (const container of containers) {
          const ratingEl = container.querySelector('span[aria-hidden="true"]');
          const ratingText = ratingEl && (ratingEl.textContent || '').trim();
          let r = null;
          if (ratingText) { const parsed = parseFloat(ratingText.replace(',', '.')); if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 5) r = parsed; }
          const reviewEl = container.querySelector('span[role="img"][aria-label*="review"], span[role="img"][aria-label*="avis"]');
          let count = null;
          if (reviewEl) {
            const aria = (reviewEl.getAttribute('aria-label') || '').trim();
            const mM = aria.match(/(\d[\d\s,]*)\s*(?:reviews?|avis)/i);
            if (mM) { const n = parseInt(mM[1].replace(/[\s,]/g, ''), 10); if (!Number.isNaN(n) && n >= 0) count = n; }
            if (count == null) { const text = (reviewEl.textContent || '').trim(); const paren = text.match(/\(([\d\s,]+)\)/); if (paren) { const n = parseInt(paren[1].replace(/[\s,]/g, ''), 10); if (!Number.isNaN(n) && n >= 0) count = n; } }
          }
          if (r != null || count != null) { if (r != null) best.rating = r; if (count != null) best.reviewCount = count; if (best.rating != null && best.reviewCount != null) break; }
        }
        return best.rating != null || best.reviewCount != null ? best : null;
      }).catch(() => null);
      if (overviewBlock) { if (overviewBlock.rating != null) rating = overviewBlock.rating; if (overviewBlock.reviewCount != null) reviewCount = overviewBlock.reviewCount; }
      if (rating == null) {
        const ratingText = await page.$eval('div.fontDisplayLarge', (el) => el.textContent?.trim()).catch(() => '');
        if (ratingText) { const r = parseFloat(ratingText.replace(',', '.')); if (!Number.isNaN(r) && r >= 0 && r <= 5) rating = r; }
      }
      if (reviewCount == null) {
        reviewCount = await page.$$eval('div.jANrlb button span, button.GQjSyb span, div.Bd93Zb button span', (spans) => {
          for (const el of spans) { const t = (el.textContent || '').trim(); const m = t.match(/(\d[\d\s]*)\s*reviews?/i); if (m) { const n = parseInt(m[1].replace(/\s/g, ''), 10); return Number.isNaN(n) || n < 0 ? null : n; } }
          return null;
        }).catch(() => null);
      }
      if (rating == null && cardData.rating != null) rating = cardData.rating;
      if (reviewCount == null && cardData.reviewCount != null) reviewCount = cardData.reviewCount;
    } catch (e) {}
    let coords = cardData.coords?.latitude ? { ...cardData.coords } : { latitude: null, longitude: null };
    const currentUrl = page.url();
    const urlCoords = extractCoordsFromUrl(currentUrl);
    if (currentUrl.includes('/place/') && urlCoords.latitude != null) coords = urlCoords;
    if (!coords.latitude) {
      try {
        const placeUrl = await page.$eval('meta[property="og:url"]', (el) => el.content).catch(() => '');
        if (placeUrl) { const metaCoords = extractCoordsFromUrl(placeUrl); if (metaCoords.latitude != null) coords = metaCoords; }
      } catch (e) {}
    }
    const googleMapsLink = cardData.googleMapsLink || (currentUrl.includes('/place/') ? currentUrl.split('?')[0] : currentUrl);
    const socialLinks = await extractSocialLinks(page);
    const record = {
      businessName,
      street: addressParts.street,
      city: addressParts.city,
      zipCode: addressParts.zipCode,
      state: addressParts.state,
      phone,
      website: websiteHref || '',
      googleMapsLink,
      latitude: coords.latitude,
      longitude: coords.longitude,
      openingHours: openingHours || '',
      rating,
      review_count: reviewCount,
      facebook: socialLinks.facebook,
      instagram: socialLinks.instagram,
      tiktok: socialLinks.tiktok,
      category: categoryName,
      country: countryCode,
      source: 'Google Maps',
    };
    return normalizeRecord(record, countryCode);
  } catch (error) {
    logger.error(`Error extracting business details: ${error.message}`);
    return null;
  }
}

function searchKey(userData) {
  const { categoryName, keyword, location } = userData;
  return `${categoryName}|${keyword}|${location}`;
}

/**
 * Extract business details assuming the page is already at the place URL (via page.goto).
 * NO elementHandle retained — the page itself is the handle. Safe against GC collection.
 */
async function extractBusinessDetailsFromPage(page, listing, categoryName, countryCode, searchLocation) {
  try {
    await page.waitForSelector('h1.DUwDvf, h1.fontHeadlineLarge', { timeout: 15000 }).catch(() => null);
    const businessName = await page.$eval('h1.DUwDvf, h1.fontHeadlineLarge', (el) => el.textContent?.trim()).catch(() => listing.name || '');
    if (!businessName) return null;
    const address = await page.$eval('button[data-item-id="address"] div.fontBodyMedium, [data-item-id="address"] .Io6YTe', (el) => el.textContent?.trim()).catch(() => '');
    const addressParts = parseAddress(address);
    if (!addressParts.city && searchLocation) addressParts.city = searchLocation;
    const phone = await page.$eval('button[data-item-id^="phone"] div.fontBodyMedium, [data-tooltip="Copy phone number"] .Io6YTe', (el) => el.textContent?.trim()).catch(() => listing.phone || '');
    const websiteHref = await page.$eval('a[data-item-id="authority"]', (el) => el.href).catch(() => '');
    const openingHours = await page.$eval('[data-item-id="oh"] .fontBodyMedium, div.t39EBf.GUrTXd, table.eK4R0e', (el) => el.textContent?.trim()).catch(() => '');

    let rating = null, reviewCount = null;
    try {
      const overviewBlock = await page.$$eval('div.fontBodyMedium.dmRWX, div.F7nice', (containers) => {
        let best = { rating: null, reviewCount: null };
        for (const container of containers) {
          const ratingEl = container.querySelector('span[aria-hidden="true"]');
          const ratingText = ratingEl && (ratingEl.textContent || '').trim();
          let r = null;
          if (ratingText) { const parsed = parseFloat(ratingText.replace(',', '.')); if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 5) r = parsed; }
          const reviewEl = container.querySelector('span[role="img"][aria-label*="review"], span[role="img"][aria-label*="avis"]');
          let count = null;
          if (reviewEl) {
            const aria = (reviewEl.getAttribute('aria-label') || '').trim();
            const mM = aria.match(/(\d[\d\s,]*)\s*(?:reviews?|avis)/i);
            if (mM) { const n = parseInt(mM[1].replace(/[\s,]/g, ''), 10); if (!Number.isNaN(n) && n >= 0) count = n; }
            if (count == null) { const text = (reviewEl.textContent || '').trim(); const paren = text.match(/\(([\d\s,]+)\)/); if (paren) { const n = parseInt(paren[1].replace(/[\s,]/g, ''), 10); if (!Number.isNaN(n) && n >= 0) count = n; } }
          }
          if (r != null || count != null) { if (r != null) best.rating = r; if (count != null) best.reviewCount = count; if (best.rating != null && best.reviewCount != null) break; }
        }
        return best.rating != null || best.reviewCount != null ? best : null;
      }).catch(() => null);
      if (overviewBlock) { if (overviewBlock.rating != null) rating = overviewBlock.rating; if (overviewBlock.reviewCount != null) reviewCount = overviewBlock.reviewCount; }
      if (rating == null) {
        const ratingText = await page.$eval('div.fontDisplayLarge', (el) => el.textContent?.trim()).catch(() => '');
        if (ratingText) { const r = parseFloat(ratingText.replace(',', '.')); if (!Number.isNaN(r) && r >= 0 && r <= 5) rating = r; }
      }
      if (reviewCount == null) {
        reviewCount = await page.$$eval('div.jANrlb button span, button.GQjSyb span, div.Bd93Zb button span', (spans) => {
          for (const el of spans) { const t = (el.textContent || '').trim(); const m = t.match(/(\d[\d\s]*)\s*reviews?/i); if (m) { const n = parseInt(m[1].replace(/\s/g, ''), 10); return Number.isNaN(n) || n < 0 ? null : n; } }
          return null;
        }).catch(() => null);
      }
      if (rating == null && listing.rating != null) rating = listing.rating;
      if (reviewCount == null && listing.reviewCount != null) reviewCount = listing.reviewCount;
    } catch (e) {}

    let coords = listing.coords?.latitude != null ? { ...listing.coords } : { latitude: null, longitude: null };
    const currentUrl = page.url();
    const urlCoords = extractCoordsFromUrl(currentUrl);
    if (currentUrl.includes('/place/') && urlCoords.latitude != null) coords = urlCoords;
    if (!coords.latitude) {
      try {
        const placeUrl = await page.$eval('meta[property="og:url"]', (el) => el.content).catch(() => '');
        if (placeUrl) { const metaCoords = extractCoordsFromUrl(placeUrl); if (metaCoords.latitude != null) coords = metaCoords; }
      } catch (e) {}
    }

    const googleMapsLink = (currentUrl.includes('/place/') ? currentUrl.split('?')[0] : (listing.href || currentUrl).split('?')[0]);
    const socialLinks = await extractSocialLinks(page);

    const record = {
      businessName,
      street: addressParts.street,
      city: addressParts.city,
      zipCode: addressParts.zipCode,
      state: addressParts.state,
      phone,
      website: websiteHref || '',
      googleMapsLink,
      latitude: coords.latitude,
      longitude: coords.longitude,
      openingHours: openingHours || '',
      rating,
      review_count: reviewCount,
      facebook: socialLinks.facebook,
      instagram: socialLinks.instagram,
      tiktok: socialLinks.tiktok,
      category: categoryName,
      country: countryCode,
      source: 'Google Maps',
    };
    return normalizeRecord(record, countryCode);
  } catch (error) {
    logger.error(`Error extracting business details (direct nav): ${error.message}`);
    return null;
  }
}

/**
 * Parse rating and review count from a card's aria-label (e.g. "4.2 stars 71 Reviews").
 */
function parseRatingAria(ariaLabel) {
  if (!ariaLabel) return { rating: null, reviewCount: null };
  const m = ariaLabel.match(/([\d.,]+)\s*stars?\s*(\d[\d\s,]*)\s*(?:reviews?|avis)/i);
  if (!m) return { rating: null, reviewCount: null };
  const r = parseFloat(m[1].replace(',', '.'));
  const n = parseInt((m[2] || '').replace(/[\s,]/g, ''), 10);
  return {
    rating: !Number.isNaN(r) && r >= 0 && r <= 5 ? r : null,
    reviewCount: !Number.isNaN(n) && n >= 0 ? n : null,
  };
}

/**
 * @param {Object} options
 * @param {string} options.country - Country code (PK, SA) or display name
 * @param {string} options.countryDisplayName - For search query "keyword in location, countryDisplayName"
 * @param {Array<{name: string, keywords: string[]}>} options.categories
 * @param {string[]} options.locations
 * @param {boolean} options.isSample
 * @param {number} [options.sampleTargetTotal=50]
 * @param {number} [options.samplePerCategoryTarget=10]
 * @param {number} [options.maxConcurrency=2]
 * @param {function(Object)} [options.onRecord] - Called for each new record (after in-scraper dedupe). Use for incremental save.
 * @param {boolean} [options.headless=true] - Run browser in headless mode. Pass false to see the browser.
 */
export async function scrapeGoogleMaps({
  country,
  countryDisplayName,
  categories,
  locations,
  isSample = false,
  sampleTargetTotal = 50,
  samplePerCategoryTarget = 10,
  maxConcurrency = 2,
  onRecord = null,
  isDuplicate = null,
  headless = true,
  minDelay = 2000,
  maxDelay = 5000,
  proxies = [],
}) {
  const allRecords = [];
  const seenNames = new Set();
  const displayName = countryDisplayName || country;

  logger.info(`[Google Maps] Starting for ${country} | ${categories.length} categories | ${locations.length} locations | sample=${isSample}`);

  const searchRequests = [];
  if (isSample && sampleTargetTotal > 0) {
    // One search per category (first keyword, first location) to spread ~10 per category
    for (const category of categories) {
      const keyword = category.keywords[0] || category.name;
      const location = locations[0] || '';
      if (!location) continue;
      searchRequests.push({
        url: buildSearchUrl(keyword, location, displayName),
        userData: { keyword, location, categoryName: category.name, country },
      });
    }
  } else {
    for (const category of categories) {
      for (const keyword of category.keywords) {
        for (const location of locations) {
          searchRequests.push({
            url: buildSearchUrl(keyword, location, displayName),
            userData: { keyword, location, categoryName: category.name, country },
          });
        }
      }
    }
  }

  logger.info(`[Google Maps] Total search URLs: ${searchRequests.length}`);
  if (proxies.length) logger.info(`[Google Maps] Using ${proxies.length} proxies with rotation`);
  logger.info(`[Google Maps] Delay range: ${minDelay}-${maxDelay}ms`);

  const proxyConfiguration = proxies.length
    ? new ProxyConfiguration({ proxyUrls: proxies })
    : undefined;

  const crawler = new PlaywrightCrawler({
    proxyConfiguration,
    launchContext: {
      launcher: chromium,
      launchOptions: {
        headless,
        args: [
          '--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--disable-extensions', '--disable-background-networking', '--disable-default-apps',
          '--disable-sync', '--disable-translate', '--metrics-recording-only',
          '--no-first-run', '--safebrowsing-disable-auto-update',
        ],
      },
    },
    maxConcurrency: 1,                          // ONE tab only — multiple tabs leak elementHandles
    navigationTimeoutSecs: 90,
    requestHandlerTimeoutSecs: 3600,            // 60 min — dense cities can have 200+ listings via direct nav
    maxRequestRetries: 0,                       // Retries recycle sessions and cause "context closed" errors
    keepAlive: true,                            // Keep browser alive between requests
    useSessionPool: true,
    sessionPoolOptions: { maxPoolSize: 1 },     // ONE session — no churn
    preNavigationHooks: [
      async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        // No resource blocking — load images, fonts, CSS. With concurrency=1 the memory cost is fine.
      },
    ],
    requestHandler: async ({ page, request, log }) => {
      const { keyword, location, categoryName, country: cc } = request.userData;
      log.info(`Processing: "${keyword}" in ${location} (${cc})`);
      emitProgress('task_start', { country: cc, city: location, category: categoryName, keyword });

      if (isSample && sampleTargetTotal > 0 && allRecords.length >= sampleTargetTotal) {
        log.info('Sample target reached, skipping this request.');
        return;
      }

      // --- Consent dialog (EU/cookie acceptance) ---
      try {
        const consentBtn = await page.$('button[aria-label="Accept all"], form[action*="consent"] button, button:has-text("Accept"), button:has-text("Accepter")');
        if (consentBtn) { await consentBtn.click(); await randomDelay(1000, 2000); }
      } catch (e) {}

      await page.waitForSelector('div[role="feed"] a.hfpxzc, div[role="feed"] div[role="article"]', { timeout: 20000 }).catch(() => {
        log.warning(`No results panel for "${keyword}" in ${location}`);
      });

      // ---- Phase A: SCROLL THE ENTIRE FEED FIRST ----
      await checkPause();
      const totalCards = await scrollFullList(page, { isSample, log });
      log.info(`Scrolled to end: ${totalCards} listings visible for "${keyword}" in ${location}`);

      // ---- Phase B: SNAPSHOT every listing as plain JS data (no elementHandles retained) ----
      const listings = await page.$$eval('div[role="feed"] div[role="article"]', (articles) =>
        articles.map((a) => {
          const linkEl = a.querySelector('a.hfpxzc');
          const nameEl = a.querySelector('div.qBF1Pd.fontHeadlineSmall');
          const phoneEl = a.querySelector('span.UsdlK');
          const ratingAriaEl = a.querySelector('span.ZkP5Je[aria-label]');
          const ratingSpan = a.querySelector('span.MW4etd');
          const reviewSpan = a.querySelector('span.UY7F9');
          return {
            href: linkEl ? linkEl.href : '',
            name: nameEl ? (nameEl.textContent || '').trim() : '',
            phone: phoneEl ? (phoneEl.textContent || '').trim() : '',
            isSponsored: !!a.querySelector('span.jHLihd'),
            ratingAria: ratingAriaEl ? (ratingAriaEl.getAttribute('aria-label') || '') : '',
            ratingText: ratingSpan ? (ratingSpan.textContent || '').trim() : '',
            reviewText: reviewSpan ? (reviewSpan.textContent || '').trim() : '',
          };
        })
      );
      log.info(`Snapshotted ${listings.length} listings — beginning detail extraction`);

      // Enrich each plain listing with parsed coords + rating/review
      const enriched = listings.map((l) => {
        const coords = extractCoordsFromUrl(l.href);
        let rating = null, reviewCount = null;
        const fromAria = parseRatingAria(l.ratingAria);
        if (fromAria.rating != null) rating = fromAria.rating;
        if (fromAria.reviewCount != null) reviewCount = fromAria.reviewCount;
        if (rating == null && l.ratingText) {
          const r = parseFloat(l.ratingText.replace(',', '.'));
          if (!Number.isNaN(r) && r >= 0 && r <= 5) rating = r;
        }
        if (reviewCount == null && l.reviewText) {
          const m = l.reviewText.match(/\(([\d\s,]+)\)/);
          if (m) {
            const n = parseInt(m[1].replace(/[\s,]/g, ''), 10);
            if (!Number.isNaN(n) && n >= 0) reviewCount = n;
          }
        }
        return { ...l, coords, rating, reviewCount, hrefKey: (l.href || '').split('?')[0] };
      });

      // ---- Phase C: visit each listing via DIRECT navigation (no goBack, no stale handles) ----
      const seenHrefs = new Set();
      let extractedCount = 0;
      let skippedDuplicates = 0;
      let skippedSponsored = 0;
      let failedCount = 0;

      for (let i = 0; i < enriched.length; i++) {
        if (isSample && sampleTargetTotal > 0 && allRecords.length >= sampleTargetTotal) break;
        await checkPause();
        const listing = enriched[i];
        if (!listing.href || !listing.hrefKey) continue;
        if (seenHrefs.has(listing.hrefKey)) continue;
        seenHrefs.add(listing.hrefKey);
        if (listing.isSponsored) {
          skippedSponsored++;
          emitProgress('record_skipped', { reason: 'sponsored', name: listing.name });
          continue;
        }

        // Pre-skip if we've already saved this business in a prior run
        if (typeof isDuplicate === 'function' && listing.name && listing.coords?.latitude != null) {
          if (isDuplicate(listing.name, listing.coords.latitude, listing.coords.longitude)) {
            log.debug(`  Skipping already-scraped: ${listing.name}`);
            skippedDuplicates++;
            emitProgress('record_duplicate', { name: listing.name });
            continue;
          }
        }

        try {
          await page.goto(listing.href, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await randomDelay(800, 1500);
          const record = await extractBusinessDetailsFromPage(page, listing, categoryName, cc, location);
          if (record && record.businessName) {
            const dedupKey = `${record.businessName.toLowerCase()}|${(record.city || '').toLowerCase()}`;
            if (!seenNames.has(dedupKey)) {
              seenNames.add(dedupKey);
              allRecords.push(record);
              extractedCount++;
              if (typeof onRecord === 'function') onRecord(record);
              emitProgress('record_saved', { name: record.businessName, city: record.city, category: categoryName, country: cc });
              log.info(`  [${allRecords.length}] ${record.businessName} - ${record.city}`);
            }
          }
          await randomDelay(minDelay, maxDelay);
        } catch (err) {
          failedCount++;
          log.error(`  Failed listing ${i + 1}/${enriched.length} (${listing.name}): ${err.message}`);
          emitProgress('record_failed', { name: listing.name, url: listing.href, error: err.message });
          // Keep going — don't bubble up. Next page.goto will replace the broken state.
        }
      }

      log.info(`Finished "${keyword}" in ${location}: extracted=${extractedCount}, dupSkipped=${skippedDuplicates}, sponsoredSkipped=${skippedSponsored}, failed=${failedCount}, total seen=${seenHrefs.size}`);
      emitProgress('task_end', { country: cc, city: location, category: categoryName, extracted: extractedCount, duplicates: skippedDuplicates, failed: failedCount });
    },
    failedRequestHandler: async ({ request, log }) => {
      log.error(`Request failed (no retries): ${request.url}`);
    },
  });

  await crawler.run(searchRequests);
  logger.info(`[Google Maps] Complete. Total records: ${allRecords.length}`);
  return allRecords;
}

export default { scrapeGoogleMaps };
