/**
 * Google Maps scraper — same selectors as GroceryStore-script.
 * Builds query as "keyword in location, countryName". Sample mode: stop at 50 records, ~10 per category.
 */

import { PlaywrightCrawler, ProxyConfiguration } from 'crawlee';
import { chromium } from 'playwright';
import logger from '../utils/logger.js';
import { randomDelay } from '../utils/rateLimiter.js';
import { checkPause } from '../utils/pauseCheck.js';
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

async function scrollResultsList(page, isSample = false) {
  const scrollable = await page.$('div[role="feed"]');
  if (!scrollable) return;
  let previousHeight = 0;
  let sameHeightCount = 0;
  const MAX_SCROLL_ATTEMPTS = isSample ? 3 : 20;
  for (let i = 0; i < MAX_SCROLL_ATTEMPTS; i++) {
    await scrollable.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await randomDelay(1500, 3000);
    const currentHeight = await scrollable.evaluate((el) => el.scrollHeight);
    const endOfResults = await page.$('span.HlvSq, p.fontBodyMedium > span > span');
    if (endOfResults) {
      const endText = await endOfResults.textContent();
      if (endText && (endText.includes('end of list') || endText.includes("You've reached the end") || endText.includes('Fin de la liste') || endText.includes('No results'))) break;
    }
    if (currentHeight === previousHeight) {
      sameHeightCount++;
      if (sameHeightCount >= 3) break;
    } else {
      sameHeightCount = 0;
      previousHeight = currentHeight;
    }
  }
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
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--disable-gpu', '--disable-dev-shm-usage'],
      },
    },
    maxConcurrency: Math.min(maxConcurrency, 2),
    navigationTimeoutSecs: 60,
    requestHandlerTimeoutSecs: 300,
    maxRequestRetries: 3,
    keepAlive: false,
    useSessionPool: true,
    sessionPoolOptions: { maxPoolSize: 5 },
    preNavigationHooks: [async ({ page }) => { await page.setViewportSize({ width: 1366, height: 768 }); }],
    requestHandler: async ({ page, request, log }) => {
      const { keyword, location, categoryName, country: cc } = request.userData;
      log.info(`Processing: "${keyword}" in ${location} (${cc})`);

      if (isSample && sampleTargetTotal > 0 && allRecords.length >= sampleTargetTotal) {
        log.info('Sample target reached, skipping this request.');
        return;
      }

      try {
        const consentBtn = await page.$('button[aria-label="Accept all"], form[action*="consent"] button, button:has-text("Accept"), button:has-text("Accepter")');
        if (consentBtn) { await consentBtn.click(); await randomDelay(minDelay, maxDelay); }
      } catch (e) {}

      await page.waitForSelector('div[role="feed"] a.hfpxzc, div[role="feed"] div[role="article"]', { timeout: 15000 }).catch(() => {
        log.warning(`No results for "${keyword}" in ${location}`);
      });

      await scrollResultsList(page, isSample);

      const listingCards = await page.$$('div[role="feed"] div[role="article"]');
      log.info(`Found ${listingCards.length} listings for "${keyword}" in ${location}`);

      const maxListings = isSample && sampleTargetTotal > 0
        ? Math.min(samplePerCategoryTarget, listingCards.length)
        : listingCards.length;

      await checkPause();
      for (let i = 0; i < maxListings; i++) {
        if (isSample && sampleTargetTotal > 0 && allRecords.length >= sampleTargetTotal) break;
        await checkPause();
        try {
          const currentCards = await page.$$('div[role="feed"] div[role="article"]');
          if (i >= currentCards.length) break;
          const cardData = await extractListingCardData(currentCards[i]);
          if (cardData.isSponsored) { log.debug(`Skipping sponsored: ${cardData.businessName}`); continue; }
          const link = await currentCards[i].$('a.hfpxzc');
          if (!link) continue;
          const record = await extractBusinessDetails(page, link, categoryName, cc, cardData, location);
          if (record && record.businessName) {
            const dedupKey = `${record.businessName.toLowerCase()}|${(record.city || '').toLowerCase()}`;
            if (!seenNames.has(dedupKey)) {
              seenNames.add(dedupKey);
              allRecords.push(record);
              if (typeof onRecord === 'function') onRecord(record);
              log.info(`  [${allRecords.length}] ${record.businessName} - ${record.city}`);
            }
          }
          await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
          await randomDelay(minDelay, maxDelay);
        } catch (error) {
          log.error(`Error processing listing ${i}: ${error.message}`);
          try { await page.goBack({ waitUntil: 'domcontentloaded' }); } catch (e) { break; }
        }
      }
      await randomDelay(minDelay, maxDelay);
    },
    failedRequestHandler: async ({ request, log }) => {
      log.error(`Request failed after retries: ${request.url}`);
    },
  });

  await crawler.run(searchRequests);
  logger.info(`[Google Maps] Complete. Total records: ${allRecords.length}`);
  return allRecords;
}

export default { scrapeGoogleMaps };
