/**
 * Google Maps Scraper Module.
 *
 * Uses Crawlee's PlaywrightCrawler with Chromium to scrape
 * business listings from Google Maps.
 *
 * VERIFIED SELECTORS (from live HTML as of Feb 2026):
 *
 * [SEARCH RESULTS LIST]
 *   Feed container:  div[role="feed"]
 *   Listing card:    div[role="article"].Nv2PK
 *   Listing link:    a.hfpxzc (href has /maps/place/ with GPS)
 *   Business name:   div.qBF1Pd.fontHeadlineSmall
 *   Rating:          span.MW4etd (number), span.UY7F9 (count)
 *   Category type:   .W4Efsd span:first-child
 *   Phone in list:   span.UsdlK
 *   Sponsored marker: h1.kpih0e span.jHLihd (text "Sponsored")
 *
 * [DETAIL PANEL - after clicking a listing]
 *   Name:           h1.DUwDvf or h1.fontHeadlineLarge
 *   Address:        button[data-item-id="address"] .Io6YTe
 *   Phone:          button[data-item-id^="phone"]
 *   Website:        a[data-item-id="authority"]
 *   Hours:          div.t39EBf.GUrTXd, table.eK4R0e
 *   Social links:   only from div.m6QErb.DxyBCb or div[aria-label^="Information for"]
 *   Rating (panel): div.fontDisplayLarge (e.g. "4.9")
 *   Review count:   div.jANrlb button span, button.GQjSyb span, div.Bd93Zb button span ("505 reviews")
 *   Rating (overview fallback): div.F7nice span[aria-hidden="true"] (e.g. "4.0")
 *   Review (overview fallback):  span[role="img"][aria-label*="review"] e.g. "(444)" / aria-label="444 reviews"
 *
 * [GPS COORDINATES]
 *   Best source: listing card link a.hfpxzc href (place URL).
 *   In the href, coords are in the pattern !3dLAT!4dLNG (e.g. !3d51.5201111!4d-0.1582575).
 *   We parse with regex /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/ and validate UK bounds.
 *
 * This is the PRIMARY data source for both UK and France.
 */

import { PlaywrightCrawler } from 'crawlee';
import { chromium } from 'playwright';
import logger from '../utils/logger.js';
import { randomDelay } from '../utils/rateLimiter.js';
import { normalizeRecord } from '../utils/normalizer.js';
import { isValidUkRecord } from '../processors/ukRecordFilter.js';
import { isWithinFranceBounds, isValidFrRecord } from '../processors/frRecordFilter.js';
import SOURCES from '../config/sources.js';

/**
 * Build Google Maps search URL for a keyword and location.
 *
 * @param {string} keyword - Search term
 * @param {string} location - City or area name
 * @param {string} country - Country code (UK, FR)
 * @returns {string} Google Maps search URL
 */
function buildSearchUrl(keyword, location, country) {
  const baseUrl =
    SOURCES[country]?.googleMaps?.searchUrl ||
    'https://www.google.com/maps/search/';
  const query = encodeURIComponent(
    `${keyword} in ${location}`,
  );
  return `${baseUrl}${query}`;
}

// UK bounds for coordinate validation (approx: lat 49.9–60.9, lng -8.6–1.8)
const UK_BOUNDS = {
  latMin: 49.5,
  latMax: 61,
  lngMin: -9,
  lngMax: 2.5,
};

/**
 * Extract coordinates from a Google Maps URL.
 * Prefer the !3dlat!4dlng pattern from listing href (a.hfpxzc) — this is the
 * place-specific coords. The @lat,lng pattern can be map center, not the place.
 *
 * @param {string} url - Current page URL or href
 * @returns {{ latitude: number|null, longitude: number|null }}
 */
function extractCoordsFromUrl(url) {
  try {
    // Prefer !3dlat!4dlng (from place URLs / listing a.hfpxzc href)
    const dataMatch = url.match(
      /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    );
    if (dataMatch) {
      return {
        latitude: parseFloat(dataMatch[1]),
        longitude: parseFloat(dataMatch[2]),
      };
    }

    // Fallback: @lat,lng (can be map center, use with caution)
    const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) {
      return {
        latitude: parseFloat(atMatch[1]),
        longitude: parseFloat(atMatch[2]),
      };
    }
  } catch (e) {
    // Ignore parsing errors
  }
  return { latitude: null, longitude: null };
}

/**
 * Check if coordinates are within UK bounds.
 *
 * @param {number|null} lat
 * @param {number|null} lng
 * @returns {boolean}
 */
function isWithinUkBounds(lat, lng) {
  if (lat == null || lng == null) return false;
  return (
    lat >= UK_BOUNDS.latMin &&
    lat <= UK_BOUNDS.latMax &&
    lng >= UK_BOUNDS.lngMin &&
    lng <= UK_BOUNDS.lngMax
  );
}

/**
 * Scroll the results panel to load all listings.
 * Google Maps uses infinite scroll in the sidebar.
 *
 * @param {import('playwright').Page} page - Playwright page
 * @param {boolean} isSample - Limit scrolling for sample mode
 */
async function scrollResultsList(page, isSample = false) {
  const scrollable = await page.$(
    'div[role="feed"]',
  );
  if (!scrollable) return;

  let previousHeight = 0;
  let sameHeightCount = 0;
  // In sample mode, scroll a few times to ensure listings load
  const MAX_SCROLL_ATTEMPTS = isSample ? 3 : 20;

  for (let i = 0; i < MAX_SCROLL_ATTEMPTS; i++) {
    // Scroll to the bottom of the results panel
    await scrollable.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });

    await randomDelay(1500, 3000);

    const currentHeight = await scrollable.evaluate(
      (el) => el.scrollHeight,
    );

    // Check for "end of results" text
    const endOfResults = await page.$(
      'span.HlvSq, p.fontBodyMedium > span > span',
    );
    if (endOfResults) {
      const endText = await endOfResults.textContent();
      if (
        endText &&
        (endText.includes('end of list') ||
          endText.includes("You've reached the end") ||
          endText.includes('Fin de la liste') ||
          endText.includes('No results'))
      ) {
        logger.info(
          'Reached end of Google Maps results list',
        );
        break;
      }
    }

    // Stop if no new content loaded after 3 tries
    if (currentHeight === previousHeight) {
      sameHeightCount++;
      if (sameHeightCount >= 3) break;
    } else {
      sameHeightCount = 0;
      previousHeight = currentHeight;
    }
  }
}

/**
 * Extract social media links from the business detail panel only.
 * Scopes to the right-hand detail panel (contains address, phone, website)
 * so we do not pick up header/footer/share links from the rest of the page.
 *
 * @param {import('playwright').Page} page - Playwright page
 * @returns {Promise<{facebook: string, instagram: string, tiktok: string}>}
 */
async function extractSocialLinks(page) {
  const socialLinks = {
    facebook: '',
    instagram: '',
    tiktok: '',
  };

  try {
    // Restrict to the business detail panel only (right-hand panel with name, address, website).
    // Avoids capturing "Share on Facebook" or header/footer links that cause duplicate social URLs.
    const panelSelector =
      'div.m6QErb.DxyBCb.kA9KIf.dS8AEf, div[aria-label^="Information for"]';
    const links = await page.$$eval(
      `${panelSelector} a[href]`,
      (anchors) => {
        const seen = new Set();
        return anchors
          .map((a) => (a.href || '').trim())
          .filter((href) => href && !seen.has(href) && (seen.add(href), true));
      },
    ).catch(() => []);

    for (const link of links) {
      const lower = link.toLowerCase();
      // Only accept links that look like business profiles (path contains /pages/ or username, not /sharer/)
      const isGenericSharer =
        lower.includes('/sharer/') ||
        lower.includes('share.php') ||
        lower.includes('dialog/');
      if (isGenericSharer) continue;

      if (
        lower.includes('facebook.com') &&
        !socialLinks.facebook
      ) {
        socialLinks.facebook = link;
      }
      if (
        lower.includes('instagram.com') &&
        !socialLinks.instagram
      ) {
        socialLinks.instagram = link;
      }
      if (
        lower.includes('tiktok.com') &&
        !socialLinks.tiktok
      ) {
        socialLinks.tiktok = link;
      }
    }
  } catch (e) {
    logger.debug(
      'Could not extract social links from detail page',
    );
  }

  return socialLinks;
}

/**
 * Extract quick data from a listing card WITHOUT clicking into it.
 * This gets basic info visible in the list view.
 *
 * @param {import('playwright').ElementHandle} card - div[role="article"]
 * @returns {Promise<Object>} Partial business data
 */
async function extractListingCardData(card) {
  const data = {
    businessName: '',
    phone: '',
    coords: { latitude: null, longitude: null },
    googleMapsLink: '',
    isSponsored: false,
    rating: null,
    reviewCount: null,
  };

  try {
    data.isSponsored = await card
      .$eval(
        'span.jHLihd',
        (el) =>
          el.textContent?.trim().toLowerCase() ===
          'sponsored',
      )
      .catch(() => false);

    data.businessName = await card
      .$eval(
        'div.qBF1Pd.fontHeadlineSmall',
        (el) => el.textContent?.trim(),
      )
      .catch(() => '');

    data.phone = await card
      .$eval(
        'span.UsdlK',
        (el) => el.textContent?.trim(),
      )
      .catch(() => '');

    const ratingAndReview = await card
      .$eval(
        'span.ZkP5Je[aria-label]',
        (el) => {
          const aria = (el.getAttribute('aria-label') || '').trim();
          const m = aria.match(
            /([\d.,]+)\s*stars?\s*(\d[\d\s,]*)\s*(?:reviews?|avis)/i,
          );
          if (m) {
            const r = parseFloat(m[1].replace(',', '.'));
            const n = parseInt((m[2] || '').replace(/[\s,]/g, ''), 10);
            return {
              rating: !Number.isNaN(r) && r >= 0 && r <= 5 ? r : null,
              reviewCount: !Number.isNaN(n) && n >= 0 ? n : null,
            };
          }
          return { rating: null, reviewCount: null };
        },
      )
      .catch(() => null);
    if (ratingAndReview) {
      if (ratingAndReview.rating != null) data.rating = ratingAndReview.rating;
      if (ratingAndReview.reviewCount != null)
        data.reviewCount = ratingAndReview.reviewCount;
    }

    if (data.rating == null || data.reviewCount == null) {
      const fromSpans = await card
        .$$eval(
          'span.MW4etd, span.UY7F9',
          (spans) => {
            let rating = null;
            let reviewCount = null;
            for (const el of spans) {
              const t = (el.textContent || '').trim();
              if (el.classList.contains('MW4etd')) {
                const r = parseFloat(t.replace(',', '.'));
                if (!Number.isNaN(r) && r >= 0 && r <= 5) rating = r;
              } else if (el.classList.contains('UY7F9')) {
                const paren = t.match(/\(([\d\s,]+)\)/);
                if (paren) {
                  const n = parseInt(paren[1].replace(/[\s,]/g, ''), 10);
                  if (!Number.isNaN(n) && n >= 0) reviewCount = n;
                }
              }
            }
            return { rating, reviewCount };
          },
        )
        .catch(() => null);
      if (fromSpans) {
        if (data.rating == null && fromSpans.rating != null)
          data.rating = fromSpans.rating;
        if (data.reviewCount == null && fromSpans.reviewCount != null)
          data.reviewCount = fromSpans.reviewCount;
      }
    }

    const href = await card
      .$eval('a.hfpxzc', (el) => el.href)
      .catch(() => '');

    if (href) {
      data.googleMapsLink = href.split('?')[0];
      data.coords = extractCoordsFromUrl(href);
    }
  } catch (e) {
  }

  return data;
}

/**
 * Extract full business details by clicking into a listing.
 *
 * @param {import('playwright').Page} page - Playwright page
 * @param {import('playwright').ElementHandle} listing - The a.hfpxzc link
 * @param {string} category - Business category name
 * @param {string} country - Country code
 * @param {Object} cardData - Pre-extracted card data
 * @param {string} searchLocation - The search location (fallback for city)
 * @returns {Promise<Object|null>} Business record or null
 */
async function extractBusinessDetails(
  page,
  listing,
  category,
  country,
  cardData,
  searchLocation = '',
) {
  try {
    // Click on the listing to open detail panel
    await listing.click();
    await randomDelay(2000, 4000);

    // Wait for the detail panel to load
    await page
      .waitForSelector('h1.DUwDvf, h1.fontHeadlineLarge', {
        timeout: 10000,
      })
      .catch(() => null);

    // Extract business name from detail panel
    const businessName = await page
      .$eval(
        'h1.DUwDvf, h1.fontHeadlineLarge',
        (el) => el.textContent?.trim(),
      )
      .catch(() => cardData.businessName || '');

    if (!businessName) return null;

    // Extract address from detail panel
    const address = await page
      .$eval(
        'button[data-item-id="address"] div.fontBodyMedium, ' +
          '[data-item-id="address"] .Io6YTe',
        (el) => el.textContent?.trim(),
      )
      .catch(() => '');

    const addressParts = parseAddress(address, country);

    // Fallback: if city is empty, use the search location
    // This handles cases where Google Maps address doesn't
    // parse cleanly (e.g., missing address or unusual format)
    if (!addressParts.city && searchLocation) {
      // Extract the main city name from the search location
      // e.g., "Tower Hamlets" → "Tower Hamlets",
      //        "Sparkhill Birmingham" → "Birmingham"
      const locationParts = searchLocation.split(' ');
      // Common patterns: "City" or "Area City"
      // Try to match a known major city from the location
      const knownUkCities = [
        'London', 'Birmingham', 'Manchester', 'Leeds',
        'Glasgow', 'Liverpool', 'Sheffield', 'Bristol',
        'Edinburgh', 'Cardiff', 'Leicester', 'Bradford',
        'Nottingham', 'Newcastle', 'Coventry',
      ];
      const knownFrCities = [
        'Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice',
        'Nantes', 'Strasbourg', 'Montpellier', 'Bordeaux',
        'Lille',
      ];
      const knownCities =
        country === 'FR' ? knownFrCities : knownUkCities;

      const matchedCity = knownCities.find((c) =>
        searchLocation
          .toLowerCase()
          .includes(c.toLowerCase()),
      );

      addressParts.city = matchedCity || searchLocation;
    }

    // Extract phone from detail panel
    const phone = await page
      .$eval(
        'button[data-item-id^="phone"] div.fontBodyMedium, ' +
          '[data-tooltip="Copy phone number"] .Io6YTe',
        (el) => el.textContent?.trim(),
      )
      .catch(() => cardData.phone || '');

    // Extract website
    const websiteHref = await page
      .$eval(
        'a[data-item-id="authority"]',
        (el) => el.href,
      )
      .catch(() => '');

    // Extract opening hours
    const openingHours = await page
      .$eval(
        '[data-item-id="oh"] .fontBodyMedium, ' +
          'div.t39EBf.GUrTXd, ' +
          'table.eK4R0e',
        (el) => el.textContent?.trim(),
      )
      .catch(() => '');

    let rating = null;
    let reviewCount = null;
    try {
      const overviewBlock = await page
        .$$eval(
          'div.fontBodyMedium.dmRWX, div.F7nice',
          (containers) => {
            let best = { rating: null, reviewCount: null };
            for (const container of containers) {
              const ratingEl = container.querySelector(
                'span[aria-hidden="true"]',
              );
              const ratingText =
                ratingEl && (ratingEl.textContent || '').trim();
              let r = null;
              if (ratingText) {
                const parsed = parseFloat(ratingText.replace(',', '.'));
                if (
                  !Number.isNaN(parsed) &&
                  parsed >= 0 &&
                  parsed <= 5
                ) {
                  r = parsed;
                }
              }
              const reviewEl = container.querySelector(
                'span[role="img"][aria-label*="review"], span[role="img"][aria-label*="avis"]',
              );
              let count = null;
              if (reviewEl) {
                const aria = (
                  reviewEl.getAttribute('aria-label') ||
                  ''
                ).trim();
                const mM = aria.match(
                  /(\d[\d\s,]*)\s*(?:reviews?|avis)/i,
                );
                if (mM) {
                  const n = parseInt(
                    mM[1].replace(/[\s,]/g, ''),
                    10,
                  );
                  if (!Number.isNaN(n) && n >= 0) count = n;
                }
                if (count == null) {
                  const text = (
                    reviewEl.textContent ||
                    ''
                  ).trim();
                  const paren = text.match(/\(([\d\s,]+)\)/);
                  if (paren) {
                    const n = parseInt(
                      paren[1].replace(/[\s,]/g, ''),
                      10,
                    );
                    if (!Number.isNaN(n) && n >= 0) count = n;
                  }
                }
              }
              if (r != null || count != null) {
                if (r != null) best.rating = r;
                if (count != null) best.reviewCount = count;
                if (best.rating != null && best.reviewCount != null) break;
              }
            }
            return best.rating != null || best.reviewCount != null
              ? best
              : null;
          },
        )
        .catch(() => null);
      if (overviewBlock) {
        if (overviewBlock.rating != null) rating = overviewBlock.rating;
        if (overviewBlock.reviewCount != null)
          reviewCount = overviewBlock.reviewCount;
      }

      if (rating == null) {
        const ratingText = await page
          .$eval(
            'div.fontDisplayLarge',
            (el) => el.textContent?.trim(),
          )
          .catch(() => '');
        if (ratingText) {
          const r = parseFloat(ratingText.replace(',', '.'));
          if (!Number.isNaN(r) && r >= 0 && r <= 5) rating = r;
        }
      }
      if (reviewCount == null) {
        reviewCount = await page
          .$$eval(
            'div.jANrlb button span, button.GQjSyb span, div.Bd93Zb button span',
            (spans) => {
              for (const el of spans) {
                const t = (el.textContent || '').trim();
                const m = t.match(/(\d[\d\s]*)\s*reviews?/i);
                if (m) {
                  const n = parseInt(m[1].replace(/\s/g, ''), 10);
                  return Number.isNaN(n) || n < 0 ? null : n;
                }
              }
              return null;
            },
          )
          .catch(() => null);
      }
      if (reviewCount == null) {
        const fromBodySmall = await page
          .$$eval(
            'div.jANrlb div.fontBodySmall, div.Bd93Zb div.fontBodySmall',
            (els) => {
              for (const el of els) {
                const t = (el.textContent || '').trim();
                const m = t.match(/(\d[\d\s,]*)\s*reviews?/i);
                if (m) {
                  const n = parseInt(m[1].replace(/[\s,]/g, ''), 10);
                  if (!Number.isNaN(n) && n >= 0) return n;
                }
              }
              return null;
            },
          )
          .catch(() => null);
        if (fromBodySmall != null) reviewCount = fromBodySmall;
      }
      if (rating == null) {
        const anyRating = await page
          .$$eval(
            'div.fontBodyMedium span[aria-hidden="true"]',
            (spans) => {
              for (const el of spans) {
                const t = (el.textContent || '').trim();
                const r = parseFloat(t.replace(',', '.'));
                if (!Number.isNaN(r) && r >= 0 && r <= 5) return t;
              }
              return null;
            },
          )
          .catch(() => null);
        if (anyRating) {
          const r = parseFloat(anyRating.replace(',', '.'));
          if (!Number.isNaN(r) && r >= 0 && r <= 5) rating = r;
        }
      }
      if (reviewCount == null) {
        const fromAriaOrText = await page
          .$$eval(
            'span[role="img"][aria-label*="review"], span[role="img"][aria-label*="avis"]',
            (spans) => {
              for (const el of spans) {
                const aria = (el.getAttribute('aria-label') || '').trim();
                const m = aria.match(
                  /(\d[\d\s,]*)\s*(?:reviews?|avis)/i,
                );
                if (m) {
                  const n = parseInt(m[1].replace(/[\s,]/g, ''), 10);
                  if (!Number.isNaN(n) && n >= 0) return n;
                }
                const text = (el.textContent || '').trim();
                const paren = text.match(/\(([\d\s,]+)\)/);
                if (paren) {
                  const n = parseInt(
                    paren[1].replace(/[\s,]/g, ''),
                    10,
                  );
                  if (!Number.isNaN(n) && n >= 0) return n;
                }
              }
              return null;
            },
          )
          .catch(() => null);
        if (fromAriaOrText != null) reviewCount = fromAriaOrText;
      }
    } catch (e) {
    }

    if (rating == null && cardData.rating != null) rating = cardData.rating;
    if (reviewCount == null && cardData.reviewCount != null)
      reviewCount = cardData.reviewCount;

    if (reviewCount == null || rating == null) {
      try {
        const reviewsTab = await page
          .locator(
            '[aria-hidden="true"]:has-text("Reviews"), div.Gpq6kf:has-text("Reviews"), button:has-text("Reviews"), a:has-text("Reviews")',
          )
          .first();
        if (await reviewsTab.isVisible().catch(() => false)) {
          await reviewsTab.click();
          await randomDelay(1500, 2500);
          if (rating == null) {
            const tabRating = await page
              .$eval(
                'div.Bd93Zb div.fontDisplayLarge',
                (el) => (el.textContent || '').trim(),
              )
              .catch(() => '');
            if (tabRating) {
              const r = parseFloat(tabRating.replace(',', '.'));
              if (!Number.isNaN(r) && r >= 0 && r <= 5) rating = r;
            }
          }
          if (reviewCount == null) {
            const tabCount = await page
              .$$eval(
                'div.Bd93Zb div.fontBodySmall, div.Bd93Zb div.jANrlb button span',
                (els) => {
                  for (const el of els) {
                    const t = (el.textContent || '').trim();
                    const m = t.match(/(\d[\d\s,]*)\s*reviews?/i);
                    if (m) {
                      const n = parseInt(
                        m[1].replace(/[\s,]/g, ''),
                        10,
                      );
                      if (!Number.isNaN(n) && n >= 0) return n;
                    }
                  }
                  return null;
                },
              )
              .catch(() => null);
            if (tabCount != null) reviewCount = tabCount;
          }
        }
      } catch (e2) {
      }
    }

    if (rating == null && cardData.rating != null) rating = cardData.rating;
    if (reviewCount == null && cardData.reviewCount != null)
      reviewCount = cardData.reviewCount;

    // Prefer coordinates from the listing card's a.hfpxzc href (place-specific).
    // After clicking, page.url() can still be the search URL with wrong/map-center coords.
    let coords = cardData.coords?.latitude
      ? { ...cardData.coords }
      : { latitude: null, longitude: null };

    const currentUrl = page.url();
    const urlCoords = extractCoordsFromUrl(currentUrl);
    const isPlaceUrl =
      currentUrl.includes('/place/') && urlCoords.latitude != null;

    if (isPlaceUrl) {
      coords = urlCoords;
    }

    // UK: reject coords outside UK bounds (e.g. -39, -74 from wrong extraction)
    if (country === 'UK' && coords.latitude != null && coords.longitude != null) {
      if (!isWithinUkBounds(coords.latitude, coords.longitude)) {
        coords =
          cardData.coords?.latitude &&
          isWithinUkBounds(
            cardData.coords.latitude,
            cardData.coords.longitude,
          )
            ? { ...cardData.coords }
            : { latitude: null, longitude: null };
      }
    }

    // FR: reject coords outside France bounds
    if (country === 'FR' && coords.latitude != null && coords.longitude != null) {
      if (!isWithinFranceBounds(coords.latitude, coords.longitude)) {
        coords =
          cardData.coords?.latitude &&
          isWithinFranceBounds(
            cardData.coords.latitude,
            cardData.coords.longitude,
          )
            ? { ...cardData.coords }
            : { latitude: null, longitude: null };
      }
    }

    // Fallback: og:url meta tag
    if (!coords.latitude) {
      try {
        const placeUrl = await page
          .$eval(
            'meta[property="og:url"]',
            (el) => el.content,
          )
          .catch(() => '');
        if (placeUrl) {
          const metaCoords = extractCoordsFromUrl(placeUrl);
          if (
            (country === 'UK' &&
              isWithinUkBounds(metaCoords.latitude, metaCoords.longitude)) ||
            (country === 'FR' &&
              isWithinFranceBounds(metaCoords.latitude, metaCoords.longitude)) ||
            (country !== 'UK' && country !== 'FR')
          ) {
            coords = metaCoords;
          }
        }
      } catch (e) {
        // Ignore
      }
    }

    // Google Maps link for this place
    const googleMapsLink =
      cardData.googleMapsLink ||
      (currentUrl.includes('/place/')
        ? currentUrl.split('?')[0]
        : currentUrl);

    // Extract social media links
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
      openingHours,
      rating,
      review_count: reviewCount,
      facebook: socialLinks.facebook,
      instagram: socialLinks.instagram,
      tiktok: socialLinks.tiktok,
      category,
      country,
      source: 'Google Maps',
    };

    const normalized = normalizeRecord(record);
    // UK dataset must not contain US or non-UK entries
    if (country === 'UK' && !isValidUkRecord(normalized)) {
      return null;
    }
    // FR dataset: must have valid FR coords and FR phone
    if (country === 'FR' && !isValidFrRecord(normalized)) {
      return null;
    }
    return normalized;
  } catch (error) {
    logger.error(
      `Error extracting business details: ${error.message}`,
    );
    return null;
  }
}

/**
 * Parse a raw address string into components.
 * Handles both UK and French address formats.
 *
 * @param {string} address - Raw address string
 * @param {string} country - Country code
 * @returns {{ street: string, city: string, zipCode: string, state: string }}
 */
function parseAddress(address, country) {
  const result = {
    street: '',
    city: '',
    zipCode: '',
    state: '',
  };

  if (!address) return result;

  // Split by commas
  const parts = address.split(',').map((p) => p.trim());

  if (country === 'UK') {
    // UK address formats from Google Maps:
    //   "117 Lupus St, Pimlico, London SW1V 3EN"
    //   "10-12 Crawford St, London W1U 6AZ, United Kingdom"
    //   "Unit 3, Bradford, BD9 4JR, Keighley Rd" (street/city must not be mixed)
    const postcodeRegex =
      /[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i;
    const streetSuffixes =
      /\b(rd|road|st|street|ln|lane|ave|avenue|dr|drive|pl|place|way|ct|close|terrace|row|gardens?|circus|sq|hill|green|park)\b\.?$/i;
    const knownUkCities = [
      'London', 'Birmingham', 'Manchester', 'Leeds', 'Glasgow', 'Liverpool',
      'Sheffield', 'Bristol', 'Edinburgh', 'Cardiff', 'Leicester', 'Bradford',
      'Nottingham', 'Newcastle', 'Coventry', 'Hull', 'Bolton', 'Plymouth',
      'Wolverhampton', 'Derby', 'Southampton', 'Portsmouth', 'Middlesbrough',
      'Reading', 'Northampton', 'Luton', 'Aberdeen', 'Dundee', 'York',
      'Oxford', 'Cambridge', 'Ipswich', 'Norwich', 'Exeter', 'Belfast',
    ];

    // Extract postcode from any part and clean the part
    for (let i = 0; i < parts.length; i++) {
      const match = parts[i].match(postcodeRegex);
      if (match) {
        result.zipCode = match[0].trim().toUpperCase();
        parts[i] = parts[i].replace(postcodeRegex, '').trim();
      }
    }

    const filteredParts = parts
      .map((p) =>
        p.replace(/^UK$|^United Kingdom$/i, '').trim(),
      )
      .filter(Boolean);

    // Classify each part as street-like or city-like to avoid mixing
    const streetParts = [];
    let cityPart = '';
    // Building/location names that must not go in city (e.g. "Park Square E", "Park House")
    const buildingOrPlacePattern =
      /\b(square|house|building|centre|center|park)\s*[a-z]?\s*$/i;
    const parkPrefix = /^park\s+/i;
    for (const p of filteredParts) {
      const isStreet =
        streetSuffixes.test(p) ||
        /^\d+[\s\-]?[A-Za-z]?$/.test(p) ||
        /unit\s+\d+/i.test(p);
      const isCity =
        knownUkCities.some((c) => c.toLowerCase() === p.toLowerCase());
      const isBuildingOrPlace =
        (buildingOrPlacePattern.test(p) || parkPrefix.test(p)) && !isCity;
      if (isStreet || isBuildingOrPlace) {
        streetParts.push(p);
      } else if (isCity && !cityPart) {
        cityPart = p;
      } else if (!isCity && !isStreet) {
        // Ambiguous: treat as street if it has a number or looks like address
        if (/^\d|unit|building|floor/i.test(p) || p.length > 20) {
          streetParts.push(p);
        } else if (!cityPart) {
          cityPart = p;
        } else {
          streetParts.push(p);
        }
      }
    }

    if (streetParts.length > 0) {
      result.street = streetParts.join(', ');
    }
    if (cityPart) {
      result.city = cityPart;
    }
    // If we didn't classify, fall back to order: first = street, last = city
    if (!result.street && !result.city && filteredParts.length >= 2) {
      result.street = filteredParts[0];
      result.city = filteredParts[filteredParts.length - 1];
      if (filteredParts.length > 2) {
        result.state = filteredParts.slice(1, -1).join(', ');
      }
    } else if (!result.street && filteredParts.length >= 1) {
      result.street = filteredParts[0];
    }
    if (!result.city && filteredParts.length >= 1 && !result.street) {
      result.city = filteredParts[0];
    }
  } else if (country === 'FR') {
    // French format: "209 avenue Versailles, 75016 Paris"
    const postcodeRegex = /\b(\d{5})\b/;

    for (let i = 0; i < parts.length; i++) {
      const match = parts[i].match(postcodeRegex);
      if (match) {
        result.zipCode = match[1];
        const afterPostcode = parts[i]
          .replace(postcodeRegex, '')
          .trim();
        if (afterPostcode) {
          result.city = afterPostcode;
        }
      }
    }

    result.street = parts[0] || '';
    if (!result.city && parts.length > 1) {
      result.city = parts[parts.length - 1]
        .replace(/^France$/i, '')
        .trim();
    }
    if (parts.length > 2) {
      result.state = parts[parts.length - 1]
        .replace(/^France$/i, '')
        .trim();
    }
  } else {
    result.street = parts[0] || '';
    result.city = parts.length > 1 ? parts[1] : '';
    result.zipCode = parts.length > 2 ? parts[2] : '';
    result.state = parts.length > 3 ? parts[3] : '';
  }

  return result;
}

/**
 * Scrape Google Maps for business listings.
 *
 * @param {Object} options
 * @param {string} options.country - Country code (UK, FR)
 * @param {Array<{name: string, keywords: string[]}>} options.categories
 * @param {string[]} options.locations - City/area names
 * @param {boolean} [options.isSample=false] - Limit results
 * @param {number} [options.maxConcurrency=3] - Concurrent pages
 * @returns {Promise<Object[]>} Array of business records
 */
/**
 * Build a unique key for one search (for progress/resume).
 *
 * @param {Object} userData - request.userData
 * @returns {string}
 */
function searchKey(userData) {
  const { categoryName, keyword, location } = userData;
  return `${categoryName}|${keyword}|${location}`;
}

/** Emit a structured progress event to stdout for the backend to parse. */
function emitProgress(event, data = {}) {
  try {
    process.stdout.write('[PROGRESS] ' + JSON.stringify({ event, ...data, timestamp: Date.now() }) + '\n');
  } catch (_) { }
}

export async function scrapeGoogleMaps({
  country,
  categories,
  locations,
  isSample = false,
  maxConcurrency = 3,
  onRecord = null,
  completedSearches = null,
  onSearchComplete = null,
}) {
  const SAMPLE_TOTAL_CAP = 10; // Hard cap when isSample — stops the crawler once reached.
  const allRecords = [];
  const seenNames = new Set();
  const completedSet =
    completedSearches instanceof Set
      ? completedSearches
      : Array.isArray(completedSearches)
        ? new Set(completedSearches)
        : new Set();

  logger.info(
    `[Google Maps] Starting scrape for ${country} | ` +
      `${categories.length} categories | ` +
      `${locations.length} locations`,
  );

  // Build search URL list
  const searchRequests = [];

  for (const category of categories) {
    for (const keyword of category.keywords) {
      for (const location of locations) {
        const userData = {
          keyword,
          location,
          categoryName: category.name,
          country,
        };
        const key = searchKey(userData);
        if (completedSet.has(key)) continue;
        searchRequests.push({
          url: buildSearchUrl(keyword, location, country),
          userData,
        });

        if (isSample) break;
      }
      if (isSample) break;
    }
  }

  const skipped = completedSet.size;
  if (skipped > 0) {
    logger.info(
      `[Google Maps] Resuming: ${skipped} searches already done, ` +
        `${searchRequests.length} remaining`,
    );
  }
  logger.info(
    `[Google Maps] Total search URLs: ${searchRequests.length}`,
  );

  const crawler = new PlaywrightCrawler({
    launchContext: {
      launcher: chromium,
      launchOptions: {
        headless: process.env.HEADLESS !== 'false',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-default-apps',
          '--disable-sync',
          '--no-first-run',
        ],
      },
    },
    maxConcurrency: Math.min(maxConcurrency, 2),
    navigationTimeoutSecs: 60,
    requestHandlerTimeoutSecs: 300,
    maxRequestRetries: 3,
    keepAlive: false,
    useSessionPool: true,
    sessionPoolOptions: { maxPoolSize: 5 },

    preNavigationHooks: [
      async ({ page }) => {
        await page.setViewportSize({
          width: 1366,
          height: 768,
        });
      },
    ],

    requestHandler: async ({ page, request, log }) => {
      const {
        keyword,
        location,
        categoryName,
        country: cc,
      } = request.userData;

      // Hard sample cap: if we've already got 10 records, skip this request.
      if (isSample && allRecords.length >= SAMPLE_TOTAL_CAP) {
        log.info('Sample cap reached, skipping remaining searches.');
        return;
      }

      log.info(
        `Processing: "${keyword}" in ${location} (${cc})`,
      );
      emitProgress('task_start', { country: cc, city: location, category: categoryName, keyword });

      // Handle Google cookie consent
      try {
        const consentBtn = await page.$(
          'button[aria-label="Accept all"], ' +
            'form[action*="consent"] button, ' +
            'button:has-text("Accept"), ' +
            'button:has-text("Accepter")',
        );
        if (consentBtn) {
          await consentBtn.click();
          await randomDelay(1000, 2000);
        }
      } catch (e) {
        // No consent dialog
      }

      // Wait for results feed to load
      // Verified: div[role="feed"] contains a.hfpxzc links
      await page
        .waitForSelector(
          'div[role="feed"] a.hfpxzc, ' +
            'div[role="feed"] div[role="article"]',
          { timeout: 15000 },
        )
        .catch(() => {
          log.warning(
            `No results for "${keyword}" in ${location}`,
          );
        });

      // Scroll to load more results
      await scrollResultsList(page, isSample);

      // Get all listing article cards
      // Verified: div[role="article"].Nv2PK
      const listingCards = await page.$$(
        'div[role="feed"] div[role="article"]',
      );

      log.info(
        `Found ${listingCards.length} listings for "${keyword}" in ${location}`,
      );

      // In sample mode, take up to 10 listings per URL so the global
      // SAMPLE_TOTAL_CAP (10) can be satisfied from a single search
      // even when the subsequent URLs misbehave (Google anti-bot, tab crash, etc).
      const maxListings = isSample
        ? Math.min(SAMPLE_TOTAL_CAP, listingCards.length)
        : listingCards.length;

      for (let i = 0; i < maxListings; i++) {
        // Respect global sample cap inside the inner loop too
        if (isSample && allRecords.length >= SAMPLE_TOTAL_CAP) break;
        try {
          // Re-fetch cards (DOM may change after goBack)
          const currentCards = await page.$$(
            'div[role="feed"] div[role="article"]',
          );

          if (i >= currentCards.length) break;

          // First extract quick data from the card (name, phone, coords)
          const cardData = await extractListingCardData(
            currentCards[i],
          );

          // Skip sponsored results
          if (cardData.isSponsored) {
            log.debug(
              `  Skipping sponsored: ${cardData.businessName}`,
            );
            emitProgress('record_skipped', { reason: 'sponsored', name: cardData.businessName });
            continue;
          }

          // Get the clickable link inside the card
          const link = await currentCards[i].$('a.hfpxzc');
          if (!link) continue;

          // Click into detail and extract full data
          const record = await extractBusinessDetails(
            page,
            link,
            categoryName,
            cc,
            cardData,
            location,
          );

          if (record && record.businessName) {
            const dedupKey =
              `${record.businessName.toLowerCase()}|${(record.city || '').toLowerCase()}`;

            if (!seenNames.has(dedupKey)) {
              seenNames.add(dedupKey);
              allRecords.push(record);
              if (onRecord) onRecord(record);
              emitProgress('record_saved', {
                name: record.businessName,
                city: record.city,
                category: categoryName,
                country: cc,
              });
              log.info(
                `  [${allRecords.length}] ${record.businessName} - ${record.city}`,
              );
            } else {
              log.debug(
                `  Skipping duplicate: ${record.businessName}`,
              );
              emitProgress('record_duplicate', { name: record.businessName });
            }
          }

          // Navigate back to results list
          await page
            .goBack({ waitUntil: 'domcontentloaded' })
            .catch(() => {});
          await randomDelay(1500, 2500);
        } catch (error) {
          log.error(
            `Error processing listing ${i}: ${error.message}`,
          );
          emitProgress('record_failed', { error: error.message });
          try {
            await page.goBack({
              waitUntil: 'domcontentloaded',
            });
          } catch (e) {
            break;
          }
        }
      }

      emitProgress('task_end', { country: cc, city: location, category: categoryName });
      await randomDelay(2000, 4000);

      if (onSearchComplete) onSearchComplete(request.userData);
    },

    failedRequestHandler: async ({ request, log }) => {
      log.error(
        `Request failed after retries: ${request.url}`,
      );
      emitProgress('record_failed', { url: request.url, error: 'Request failed after retries' });
    },
  });

  await crawler.run(searchRequests);

  logger.info(
    `[Google Maps] Scrape complete for ${country}. ` +
      `Total records: ${allRecords.length}`,
  );

  return allRecords;
}

export default { scrapeGoogleMaps };
