/**
 * Google Maps search URL only (this scraper is Google Maps-only).
 */

const SOURCES = {
  PK: {
    googleMaps: {
      baseUrl: 'https://www.google.com/maps',
      searchUrl: 'https://www.google.com/maps/search/',
    },
  },
  SA: {
    googleMaps: {
      baseUrl: 'https://www.google.com/maps',
      searchUrl: 'https://www.google.com/maps/search/',
    },
  },
};

/**
 * Get Google Maps search base URL for a country. Default for any country.
 */
export function getSearchUrl(country) {
  const key = country && typeof country === 'string' ? country.toUpperCase() : '';
  return SOURCES[key]?.googleMaps?.searchUrl || 'https://www.google.com/maps/search/';
}

export default SOURCES;
