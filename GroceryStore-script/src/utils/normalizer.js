/**
 * Data Normalizer Utility.
 *
 * Cleans and normalizes scraped data fields:
 * - Trims whitespace
 * - Normalizes phone numbers
 * - Cleans URLs
 * - Ensures UTF-8 encoding compatibility
 * - Standardizes address components
 */

export function toTitleCase(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .trim()
    .split(/\s+/)
    .map((word) =>
      word.length > 0
        ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        : word,
    )
    .join(' ');
}

export function normalizeName(name) {
  if (!name) return '';
  return name
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize a phone number.
 * Removes non-numeric characters except + and spaces.
 *
 * @param {string} phone - Raw phone number
 * @returns {string} Cleaned phone number
 */
export function normalizePhone(phone) {
  if (!phone) return '';
  return phone
    .replace(/[^\d+\s()-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize a URL.
 * Ensures it starts with https:// (client requirement: no http).
 *
 * @param {string} url - Raw URL
 * @returns {string} Cleaned URL
 */
export function normalizeUrl(url) {
  if (!url) return '';
  let cleaned = url.trim();

  // Remove trailing slashes for consistency
  cleaned = cleaned.replace(/\/+$/, '');

  // Add protocol if missing
  if (
    cleaned &&
    !cleaned.startsWith('http://') &&
    !cleaned.startsWith('https://')
  ) {
    cleaned = `https://${cleaned}`;
  }

  // Client requirement: use https only
  if (cleaned.toLowerCase().startsWith('http://')) {
    cleaned = 'https://' + cleaned.slice(7);
  }

  return cleaned;
}

/**
 * Normalize an address string.
 * Trims whitespace, removes extra spaces and commas.
 *
 * @param {string} address - Raw address
 * @returns {string} Cleaned address
 */
export function normalizeAddress(address) {
  if (!address) return '';
  return address
    .replace(/\s+/g, ' ')
    .replace(/,\s*,/g, ',')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim();
}

/**
 * Extract and validate social media URLs.
 * Returns empty string if URL doesn't match the platform.
 *
 * @param {string} url - URL to validate
 * @param {string} platform - 'facebook', 'instagram', or 'tiktok'
 * @returns {string} Validated URL or empty string
 */
export function validateSocialMedia(url, platform) {
  if (!url) return '';

  const cleaned = url.trim().toLowerCase();
  const patterns = {
    facebook: /facebook\.com/,
    instagram: /instagram\.com/,
    tiktok: /tiktok\.com/,
  };

  if (patterns[platform] && patterns[platform].test(cleaned)) {
    return normalizeUrl(url);
  }

  return '';
}

/**
 * Normalize latitude/longitude coordinates.
 * Returns null if invalid.
 *
 * @param {string|number} coord - Raw coordinate value
 * @returns {number|null} Parsed coordinate or null
 */
export function normalizeCoordinate(coord) {
  if (coord === null || coord === undefined || coord === '') {
    return null;
  }

  const parsed = parseFloat(coord);
  if (isNaN(parsed)) return null;

  // Round to 7 decimal places (sub-meter precision)
  return Math.round(parsed * 1e7) / 1e7;
}

/**
 * Normalize opening hours string.
 *
 * Google Maps returns hours as a single concatenated string like:
 *   "SaturdayClosedSundayClosedMonday9 AM–6 PMTuesday9 AM–6 PM..."
 * or:
 *   "Open 24 hours"
 *
 * This function parses it into a clean, readable format:
 *   "Mon: 9 AM - 6 PM | Tue: 9 AM - 6 PM | Sat: Closed"
 *
 * Also handles French day names for FR data.
 *
 * @param {string} hours - Raw opening hours
 * @returns {string} Cleaned opening hours
 */
export function normalizeHours(hours) {
  if (!hours) return '';

  let cleaned = hours.trim();

  // Remove common suffixes from Google Maps
  cleaned = cleaned
    .replace(/Suggest new hours/gi, '')
    .replace(/Hide open hours/gi, '')
    .replace(/Open hours/gi, '')
    .replace(/Hours might differ/gi, '')
    .replace(/See more hours/gi, '')
    .replace(/Confirm these hours/gi, '')
    .trim();

  // If it's a simple status, return as-is
  if (/^open\s+24\s+hours$/i.test(cleaned)) {
    return 'Open 24 hours';
  }
  if (/^closed$/i.test(cleaned) || !cleaned) {
    return cleaned || '';
  }

  // Day names in English and French, with abbreviations
  const dayPatterns = [
    { regex: 'Monday', abbr: 'Mon' },
    { regex: 'Tuesday', abbr: 'Tue' },
    { regex: 'Wednesday', abbr: 'Wed' },
    { regex: 'Thursday', abbr: 'Thu' },
    { regex: 'Friday', abbr: 'Fri' },
    { regex: 'Saturday', abbr: 'Sat' },
    { regex: 'Sunday', abbr: 'Sun' },
    // French
    { regex: 'lundi', abbr: 'Lun' },
    { regex: 'mardi', abbr: 'Mar' },
    { regex: 'mercredi', abbr: 'Mer' },
    { regex: 'jeudi', abbr: 'Jeu' },
    { regex: 'vendredi', abbr: 'Ven' },
    { regex: 'samedi', abbr: 'Sam' },
    { regex: 'dimanche', abbr: 'Dim' },
  ];

  // Build a regex to split by day names
  const dayNames = dayPatterns.map((d) => d.regex);
  const splitRegex = new RegExp(
    `(${dayNames.join('|')})`,
    'gi',
  );

  // Check if the string contains recognizable day names
  const hasDays = splitRegex.test(cleaned);
  if (!hasDays) {
    // No day names found, just clean up whitespace
    return cleaned
      .replace(/\s+/g, ' ')
      .replace(/\n/g, ' | ')
      .trim();
  }

  // Reset regex lastIndex after test
  splitRegex.lastIndex = 0;

  // Split the string by day names, keeping the day names
  const parts = cleaned.split(splitRegex).filter(Boolean);

  const dayHours = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    // Check if this part is a day name
    const dayMatch = dayPatterns.find(
      (d) => d.regex.toLowerCase() === part.toLowerCase(),
    );
    if (dayMatch) {
      // The next part (if exists) is the hours for this day
      const hoursPart =
        i + 1 < parts.length ? parts[i + 1].trim() : '';
      // Skip if next part is also a day name
      const nextIsDay = dayPatterns.some(
        (d) =>
          d.regex.toLowerCase() === hoursPart.toLowerCase(),
      );
      const timeStr = nextIsDay ? 'Closed' : hoursPart || 'Closed';

      // Clean up the time string
      const cleanTime = timeStr
        .replace(/\s+/g, ' ')
        .replace(/–/g, '-')
        .replace(/—/g, '-')
        // Fix multi-range: "10 AM-2 PM4-8:30 PM" → "10 AM-2 PM, 4-8:30 PM"
        .replace(/(AM|PM)(\d)/gi, '$1, $2')
        .trim();

      dayHours.push(`${dayMatch.abbr}: ${cleanTime}`);
      if (!nextIsDay) i++; // Skip the hours part
    }
  }

  if (dayHours.length > 0) {
    return dayHours.join(' | ');
  }

  // Fallback: just clean up
  return cleaned
    .replace(/\s+/g, ' ')
    .replace(/\n/g, ' | ')
    .trim();
}

/**
 * Normalize an entire business record.
 * Applies all normalization functions to a record object.
 *
 * @param {Object} record - Raw business record
 * @returns {Object} Normalized business record
 */
export function normalizeRecord(record) {
  return {
    ...record,
    businessName: normalizeName(record.businessName),
    street: normalizeAddress(record.street),
    city: normalizeName(record.city),
    zipCode: record.zipCode ? record.zipCode.trim() : '',
    state: normalizeName(record.state),
    phone: normalizePhone(record.phone),
    website: normalizeUrl(record.website),
    googleMapsLink: record.googleMapsLink
      ? record.googleMapsLink.trim()
      : '',
    latitude: normalizeCoordinate(record.latitude),
    longitude: normalizeCoordinate(record.longitude),
    openingHours: normalizeHours(record.openingHours),
    rating:
      record.rating != null && record.rating !== ''
        ? (() => {
            const n =
              typeof record.rating === 'number'
                ? record.rating
                : parseFloat(record.rating);
            return Number.isNaN(n) ? null : n;
          })()
        : null,
    review_count:
      record.review_count != null && record.review_count !== ''
        ? (() => {
            const n =
              typeof record.review_count === 'number'
                ? record.review_count
                : parseInt(record.review_count, 10);
            return Number.isNaN(n) ? null : n;
          })()
        : null,
    facebook: validateSocialMedia(record.facebook, 'facebook'),
    instagram: validateSocialMedia(
      record.instagram,
      'instagram',
    ),
    tiktok: validateSocialMedia(record.tiktok, 'tiktok'),
  };
}

export default {
  toTitleCase,
  normalizeName,
  normalizePhone,
  normalizeUrl,
  normalizeAddress,
  validateSocialMedia,
  normalizeCoordinate,
  normalizeHours,
  normalizeRecord,
};
