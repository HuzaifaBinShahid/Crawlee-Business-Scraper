/**
 * Country code / alias to display name for Google Maps search queries.
 * Query format: "keyword in location, CountryName"
 */

const CODE_TO_NAME = {
  PK: 'Pakistan',
  SA: 'Saudi Arabia',
  PAK: 'Pakistan',
  SAU: 'Saudi Arabia',
  KSA: 'Saudi Arabia',
  UK: 'United Kingdom',
  GB: 'United Kingdom',
  FR: 'France',
  DE: 'Germany',
  ES: 'Spain',
  IT: 'Italy',
  NL: 'Netherlands',
  BE: 'Belgium',
  PT: 'Portugal',
  AT: 'Austria',
  CH: 'Switzerland',
  IE: 'Ireland',
  PL: 'Poland',
  SE: 'Sweden',
  NO: 'Norway',
  DK: 'Denmark',
  FI: 'Finland',
  GR: 'Greece',
  IN: 'India',
  TR: 'Turkey',
  AE: 'United Arab Emirates',
  EG: 'Egypt',
};

const ALIASES_TO_CODE = {
  pakistan: 'PK', pak: 'PK', pk: 'PK',
  saudi: 'SA', 'saudi arabia': 'SA', ksa: 'SA', sa: 'SA',
  uk: 'UK', 'united kingdom': 'UK', britain: 'UK', 'great britain': 'UK', england: 'UK', gb: 'UK',
  france: 'FR', fr: 'FR',
  germany: 'DE', de: 'DE', deutschland: 'DE',
  spain: 'ES', es: 'ES',
  italy: 'IT', it: 'IT',
  netherlands: 'NL', nl: 'NL',
  belgium: 'BE', be: 'BE',
  portugal: 'PT', pt: 'PT',
  austria: 'AT', at: 'AT',
  switzerland: 'CH', ch: 'CH',
  ireland: 'IE', ie: 'IE',
  poland: 'PL', pl: 'PL',
  sweden: 'SE', se: 'SE',
  norway: 'NO', no: 'NO',
  denmark: 'DK', dk: 'DK',
  finland: 'FI', fi: 'FI',
  greece: 'GR', gr: 'GR',
  india: 'IN', in: 'IN',
  turkey: 'TR', tr: 'TR',
  'united arab emirates': 'AE', uae: 'AE', ae: 'AE',
  egypt: 'EG', eg: 'EG',
};

/**
 * Get display name for search query. If code is known, return full country name; else return as-is.
 * @param {string} country - User input (e.g. PK, SA, Pakistan, India)
 * @returns {string} Display name for "keyword in city, DisplayName"
 */
export function getCountryDisplayName(country) {
  if (!country || typeof country !== 'string') return '';
  const trimmed = country.trim();
  const upper = trimmed.toUpperCase();
  const lower = trimmed.toLowerCase();

  if (CODE_TO_NAME[upper]) return CODE_TO_NAME[upper];
  if (ALIASES_TO_CODE[lower]) return CODE_TO_NAME[ALIASES_TO_CODE[lower]] || trimmed;
  return trimmed;
}

/**
 * Normalize user input to a 2-letter country code for config lookup (PK, SA) or null for generic.
 * @param {string} country - User input
 * @returns {string} PK, SA, or original string (e.g. India) for generic
 */
export function normalizeCountryCode(country) {
  if (!country || typeof country !== 'string') return '';
  const lower = country.trim().toLowerCase();
  if (ALIASES_TO_CODE[lower]) return ALIASES_TO_CODE[lower].toUpperCase();
  if (lower === 'pk' || lower === 'pakistan') return 'PK';
  if (lower === 'sa' || lower === 'saudi' || lower === 'saudi arabia' || lower === 'ksa') return 'SA';
  return country.trim();
}

export default { getCountryDisplayName, normalizeCountryCode, CODE_TO_NAME, ALIASES_TO_CODE };
